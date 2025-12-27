import logging
from datetime import datetime, timezone

from .db_reader import DatabaseReader
from .models import Conversation, ExportData, Message, Tapback
from .utils import (
    apple_timestamp_to_datetime,
    calculate_read_duration,
    extract_text_from_attributed_body,
    get_tapback_type,
    is_tapback,
    strip_guid_prefix,
)

ME = "Me"
logger = logging.getLogger(__name__)


class MessageProcessor:
    def __init__(self, reader: DatabaseReader):
        self.reader = reader
        self._guid_to_message = {}

    def process_year(self, year: int) -> ExportData:
        logger.debug(f"Processing messages for year {year}")
        conversations = self._build_conversations(year)
        logger.debug(f"Built {len(conversations)} conversations")

        return ExportData(
            export_date=datetime.now(timezone.utc),
            year=year,
            conversations=conversations,
        )

    def _build_conversations(self, year: int) -> dict[str, Conversation]:
        chat_participants = self.reader.fetch_chat_participants()
        conversations = {}
        message_index = {}
        tapback_queue = []

        for row in self.reader.fetch_messages(year):
            chat_id = row["chat_id"]
            if chat_id is None:
                continue

            chat_key = f"chat_{chat_id}"

            if chat_key not in conversations:
                conversations[chat_key] = self._create_conversation(row, chat_id, chat_participants)

            if is_tapback(row["associated_message_type"]):
                tapback_queue.append(row)
                continue

            message = self._create_message(row)
            if message:
                if message.timestamp.year != year:
                    message.is_context_only = True
                conversations[chat_key].messages.append(message)
                message_index[message.guid] = message

        missing_parent_guids = []
        for tapback_row in tapback_queue:
            parent_guid = strip_guid_prefix(tapback_row["associated_message_guid"])
            if parent_guid and parent_guid not in message_index:
                missing_parent_guids.append(parent_guid)

        if missing_parent_guids:
            unique_missing = list(set(missing_parent_guids))
            logger.debug(
                f"Fetching {len(unique_missing)} unique parent messages for tapbacks from other years"
            )
            logger.debug(f"Sample GUIDs: {unique_missing[:5]}")
            fetched_count = 0
            added_to_index = 0
            tapback_messages = 0
            for row in self.reader.fetch_messages_by_guids(unique_missing):
                fetched_count += 1
                if is_tapback(row["associated_message_type"]):
                    tapback_messages += 1
                    continue
                message = self._create_message(row)
                if message:
                    if message.timestamp.year != year:
                        message.is_context_only = True
                    message_index[message.guid] = message
                    added_to_index += 1

                    chat_id = row["chat_id"]
                    if chat_id:
                        chat_key = f"chat_{chat_id}"
                        if chat_key not in conversations:
                            conversations[chat_key] = self._create_conversation(
                                row, chat_id, chat_participants
                            )
                        conversations[chat_key].messages.append(message)
            logger.debug(
                f"Fetched {fetched_count} rows from DB, skipped {tapback_messages} tapback messages, added {added_to_index} parent messages to index"
            )

        self._apply_tapbacks(tapback_queue, message_index)

        return conversations

    def _create_conversation(
        self, row: dict, chat_id: int, all_participants: dict[int, list[str]]
    ) -> Conversation:
        chat_identifier = row["chat_identifier"] or f"unknown_{chat_id}"
        display_name = row["chat_display_name"]
        participants = all_participants.get(chat_id, [])

        is_group = len(participants) > 1

        return Conversation(
            chat_id=chat_id,
            chat_identifier=chat_identifier,
            display_name=display_name,
            is_group_chat=is_group,
            participants=participants,
        )

    def _create_message(self, row: dict) -> Message | None:
        text = row["text"]
        if not text and row["attributed_body"]:
            text = extract_text_from_attributed_body(row["attributed_body"])

        timestamp = apple_timestamp_to_datetime(row["date"])
        if not timestamp:
            return None

        read_duration = None
        if row["date_read"]:
            read_duration = calculate_read_duration(row["date"], row["date_read"])

        sender = ME if row["is_from_me"] else (row["sender_id"] or "Unknown")
        service = row["service"] or "iMessage"

        return Message(
            id=row["message_id"],
            guid=row["message_guid"],
            timestamp=timestamp,
            is_from_me=bool(row["is_from_me"]),
            sender=sender,
            text=text,
            service=service,
            has_attachment=bool(row["cache_has_attachments"]),
            date_read_after_seconds=read_duration,
        )

    def _apply_tapbacks(self, tapback_queue: list[dict], message_index: dict[str, Message]) -> None:
        total_tapbacks = len(tapback_queue)
        applied_count = 0
        skipped_no_guid = 0
        skipped_no_type = 0
        skipped_no_parent = 0

        for tapback_row in tapback_queue:
            parent_guid = strip_guid_prefix(tapback_row["associated_message_guid"])
            tapback_type = get_tapback_type(tapback_row["associated_message_type"])

            if not parent_guid:
                skipped_no_guid += 1
                continue

            if not tapback_type:
                skipped_no_type += 1
                continue

            parent_message = message_index.get(parent_guid)
            if not parent_message:
                skipped_no_parent += 1
                continue

            sender = ME if tapback_row["is_from_me"] else (tapback_row["sender_id"] or "Unknown")

            parent_message.tapbacks.append(Tapback(type=tapback_type, by=sender))
            applied_count += 1

        logger.debug(
            f"Tapback application stats: total={total_tapbacks}, applied={applied_count}, "
            f"skipped_no_guid={skipped_no_guid}, skipped_no_type={skipped_no_type}, "
            f"skipped_no_parent={skipped_no_parent}"
        )


class MessageService:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path

    def export_year(self, year: int) -> ExportData:
        with DatabaseReader(self.db_path) as reader:
            processor = MessageProcessor(reader)
            return processor.process_year(year)

import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Iterator

from .utils import datetime_to_apple_timestamp

logger = logging.getLogger(__name__)


class DatabaseReader:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.path.expanduser("~/Library/Messages/chat.db")
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        logger.debug(f"Connecting to database: {self.db_path}")
        self._conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
        self._conn.row_factory = sqlite3.Row
        logger.debug("Database connection established")

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def get_table_columns(self, table_name: str) -> list[str]:
        assert self._conn is not None, "Database not connected"
        cursor = self._conn.execute(f"PRAGMA table_info({table_name})")
        columns = [row[1] for row in cursor.fetchall()]
        logger.debug(f"Columns in {table_name}: {columns}")
        return columns

    def fetch_messages(self, year: int, batch_size: int = 1000) -> Iterator[dict]:
        logger.debug(f"Fetching messages for year {year}")

        message_columns = self.get_table_columns("message")
        logger.debug(f"Available message columns: {message_columns}")

        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        start_ns = datetime_to_apple_timestamp(start)
        end_ns = datetime_to_apple_timestamp(end)

        logger.debug(f"Date range: {start} to {end}")
        logger.debug(f"Timestamp range: {start_ns} to {end_ns}")

        query = """
        SELECT
            m.ROWID as message_id,
            m.guid as message_guid,
            m.text,
            m.attributedBody as attributed_body,
            m.date,
            m.date_read,
            m.is_from_me,
            m.cache_has_attachments,
            m.associated_message_guid,
            m.associated_message_type,
            h.id as sender_id,
            h.service,
            c.ROWID as chat_id,
            c.chat_identifier,
            c.display_name as chat_display_name
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.date >= ? AND m.date <= ?
        ORDER BY m.date ASC
        """

        logger.debug(f"Executing query with parameters: start_ns={start_ns}, end_ns={end_ns}")
        assert self._conn is not None, "Database not connected"
        cursor = self._conn.execute(query, (start_ns, end_ns))
        logger.debug("Query executed successfully")

        while True:
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break
            for row in rows:
                yield dict(row)

    def fetch_chat_participants(self) -> dict[int, list[str]]:
        assert self._conn is not None, "Database not connected"
        query = """
        SELECT chj.chat_id, h.id as participant_id
        FROM chat_handle_join chj
        JOIN handle h ON chj.handle_id = h.ROWID
        ORDER BY chj.chat_id
        """

        cursor = self._conn.execute(query)
        participants = {}

        for row in cursor:
            chat_id = row["chat_id"]
            participant_id = row["participant_id"]
            if chat_id not in participants:
                participants[chat_id] = []
            participants[chat_id].append(participant_id)

        return participants

    def fetch_messages_by_guids(self, guids: list[str]) -> Iterator[dict]:
        if not guids:
            return

        assert self._conn is not None, "Database not connected"
        placeholders = ",".join("?" * len(guids))
        query = f"""
        SELECT
            m.ROWID as message_id,
            m.guid as message_guid,
            m.text,
            m.attributedBody as attributed_body,
            m.date,
            m.date_read,
            m.is_from_me,
            m.cache_has_attachments,
            m.associated_message_guid,
            m.associated_message_type,
            h.id as sender_id,
            h.service,
            c.ROWID as chat_id,
            c.chat_identifier,
            c.display_name as chat_display_name
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.guid IN ({placeholders})
        """

        cursor = self._conn.execute(query, guids)
        for row in cursor:
            yield dict(row)

import logging
import re
from abc import ABC, abstractmethod
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from math import log
from typing import Any, Callable, Optional, Sequence

from .ghost import (
    ConversationFilter,
    apply_conversation_filters,
    compute_ghost_stats,
    minimum_responses_filter,
    minimum_total_messages_filter,
    received_to_sent_ratio_filter,
)
from .models import Conversation, ExportData, Message
from .phrases import PhraseExtractionConfig, PhraseExtractor
from .phrases.tokenizer import SimpleTokenizer
from .sentiment import LexicalSentimentAnalyzer, SentimentResult
from .utils import count_emojis


class StatisticsAnalyzer(ABC):
    @abstractmethod
    def analyze(self, data: ExportData) -> dict[str, Any]:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass


logger = logging.getLogger(__name__)

CLIFFHANGER_PATTERNS = [
    "i'll tell you later",
    "ill tell you later",
    "tell you later",
    "wait till you hear",
    "more on that later",
    "remind me to tell you",
    "i'll explain later",
    "ill explain later",
]
CLIFFHANGER_TIMEOUT = timedelta(hours=12)
CRASHOUT_MIN_STREAK = 3
CRASHOUT_MAX_WINDOW = timedelta(hours=1)
CRASHOUT_SCORE_MULTIPLIER = 4.0
TOP_CONVERSATION_WORD_LIMIT = 10
TOP_CONVERSATION_MIN_TOKEN_LENGTH = 2
TOP_CONVERSATION_PHRASE_NGRAM_RANGE = (2, 5)
TOP_CONVERSATION_PHRASE_LIMIT = 5
TOP_CONVERSATION_PHRASE_MIN_OCCURRENCES = 1
TOP_CONVERSATION_PHRASE_MIN_CHARACTERS = 4
TOP_CONVERSATION_PHRASE_FILTER_BANK = {"http", "https"}
CONVERSATION_SESSION_GAP_HOURS = 6
MAX_STARTER_EXAMPLES = 8


class RawStatisticsAnalyzer(StatisticsAnalyzer):
    def __init__(
        self,
        sentiment_progress: Optional[Callable[[str, int, int], None]] = None,
        phrase_config: PhraseExtractionConfig | None = None,
        ghost_timeline_days: int = 7,
        ghost_min_consecutive_messages: int = 3,
        ghost_min_conversation_messages: int = 10,
        conversation_filters: Sequence[ConversationFilter] | None = None,
        include_group_chats_in_ghosts: bool = False,
    ) -> None:
        self._sentiment_analyzer = self._build_sentiment_analyzer()
        self._sentiment_interval = "month"
        self._sentiment_progress = sentiment_progress
        self._sentiment_model_info = getattr(self._sentiment_analyzer, "model_info", None)
        self._phrase_extractor = PhraseExtractor(config=phrase_config)
        self._word_tokenizer = SimpleTokenizer()
        self._word_stopwords = getattr(self._phrase_extractor, "_stopwords", set())

        if ghost_timeline_days <= 0:
            raise ValueError("ghost_timeline_days must be a positive integer")
        self._ghost_timeline = timedelta(days=ghost_timeline_days)
        self._ghost_min_consecutive = ghost_min_consecutive_messages
        self._ghost_min_conversation_messages = ghost_min_conversation_messages
        self._include_group_chats_in_ghosts = include_group_chats_in_ghosts

        if conversation_filters is None:
            conversation_filters = (
                minimum_total_messages_filter(min_total_messages=ghost_min_conversation_messages),
                received_to_sent_ratio_filter(max_ratio=9.0, min_messages_required=2),
                minimum_responses_filter(min_user_responses=2),
            )
        self._conversation_filters: Sequence[ConversationFilter] = conversation_filters

    @property
    def name(self) -> str:
        return "raw"

    @property
    def sentiment_model_info(self) -> dict[str, Any] | None:
        return self._sentiment_model_info

    @staticmethod
    def _to_local_time(dt):
        """Convert UTC datetime to local timezone for temporal analysis."""
        if dt.tzinfo is None:
            return dt
        if dt.tzinfo == timezone.utc:
            return dt.astimezone()
        return dt

    def analyze(self, data: ExportData) -> dict[str, Any]:
        conversations = self._filtered_conversations(data)
        all_messages = self._flatten_messages(data, conversations=conversations)
        all_messages_with_context = self._flatten_messages(
            data, include_context=True, conversations=conversations
        )
        sent_messages = [m for m in all_messages if m.is_from_me]
        received_messages = [m for m in all_messages if not m.is_from_me]
        # Contacts should reflect everyone you messaged or heard from, even if a
        # conversation was filtered out of other analyses. Use the full set.
        contact_conversations = data.conversations

        return {
            "volume": self._analyze_volume(all_messages, sent_messages, received_messages),
            "temporal": self._analyze_temporal_patterns(data, sent_messages, conversations),
            "contacts": self._analyze_contacts(
                data, sent_messages, received_messages, conversations=contact_conversations
            ),
            "content": self._analyze_content(
                data, sent_messages, received_messages, conversations=conversations
            ),
            "conversations": self._analyze_conversations(data, conversations=conversations),
            "top_conversation_deep_dive": self._analyze_top_conversation(
                data, conversations=conversations
            ),
            "response_times": self._analyze_response_times(data, conversations=conversations),
            "tapbacks": self._analyze_tapbacks(
                all_messages_with_context, sent_messages, received_messages
            ),
            "crashout": self._analyze_crashout(data, conversations=conversations),
            "streaks": self._analyze_streaks(data, conversations=conversations),
            "ghosts": self._analyze_ghosts(conversations, data),
            "cliffhangers": self._analyze_cliffhangers(data, conversations),
        }

    def _filtered_conversations(self, data: ExportData) -> dict[str, Conversation]:
        return apply_conversation_filters(
            data.conversations, year=data.year, filters=self._conversation_filters
        )

    def _flatten_messages(
        self,
        data: ExportData,
        include_context: bool = False,
        conversations: dict[str, Conversation] | None = None,
    ) -> list[Message]:
        messages = []
        convs = conversations or data.conversations
        for conv in convs.values():
            for msg in conv.messages:
                if not self._should_include_message(msg, data.year, include_context):
                    continue
                messages.append(msg)
        return sorted(messages, key=lambda m: m.timestamp)

    def _should_include_message(
        self,
        message: Message,
        year: int,
        include_context: bool = False,
    ) -> bool:
        if include_context:
            return True
        if getattr(message, "is_context_only", False):
            return False
        return message.timestamp.year == year

    def _analyze_volume(
        self,
        all_messages: list[Message],
        sent_messages: list[Message],
        received_messages: list[Message],
    ) -> dict[str, Any]:
        sent_by_date = defaultdict(int)
        received_by_date = defaultdict(int)

        for msg in sent_messages:
            local_time = self._to_local_time(msg.timestamp)
            sent_by_date[local_time.date()] += 1

        for msg in received_messages:
            local_time = self._to_local_time(msg.timestamp)
            received_by_date[local_time.date()] += 1

        busiest_day_total = max(
            (
                (date, sent_by_date[date] + received_by_date[date])
                for date in set(sent_by_date.keys()) | set(received_by_date.keys())
            ),
            key=lambda x: x[1],
            default=(None, 0),
        )

        daily_activity = {}
        all_dates = set(sent_by_date.keys()) | set(received_by_date.keys())
        for date in all_dates:
            daily_activity[date.isoformat()] = {
                "sent": sent_by_date.get(date, 0),
                "received": received_by_date.get(date, 0),
                "total": sent_by_date.get(date, 0) + received_by_date.get(date, 0),
            }

        return {
            "total_messages": len(all_messages),
            "total_sent": len(sent_messages),
            "total_received": len(received_messages),
            "busiest_day": {
                "date": busiest_day_total[0].isoformat() if busiest_day_total[0] else None,
                "total": busiest_day_total[1],
                "sent": sent_by_date.get(busiest_day_total[0], 0) if busiest_day_total[0] else 0,
                "received": received_by_date.get(busiest_day_total[0], 0)
                if busiest_day_total[0]
                else 0,
            },
            "most_sent_in_day": max(sent_by_date.values()) if sent_by_date else 0,
            "most_received_in_day": max(received_by_date.values()) if received_by_date else 0,
            "active_days": len(set(sent_by_date.keys()) | set(received_by_date.keys())),
            "days_sent": len(sent_by_date),
            "days_received": len(received_by_date),
            "daily_activity": daily_activity,
        }

    def _analyze_temporal_patterns(
        self,
        data: ExportData,
        sent_messages: list[Message],
        conversations: dict[str, Conversation],
    ) -> dict[str, Any]:
        hour_distribution = Counter(
            self._to_local_time(msg.timestamp).hour for msg in sent_messages
        )
        day_of_week_distribution = Counter(
            self._to_local_time(msg.timestamp).weekday() for msg in sent_messages
        )
        month_distribution = Counter(
            self._to_local_time(msg.timestamp).month for msg in sent_messages
        )

        sorted_hour = dict(sorted(hour_distribution.items()))
        sorted_day = dict(sorted(day_of_week_distribution.items()))

        weekday_counts = sum(count for day, count in sorted_day.items() if day < 5)
        weekend_counts = sum(count for day, count in sorted_day.items() if day >= 5)
        total_sent = sum(sorted_day.values()) or 1

        weekday_contact_counts: dict[str, int] = defaultdict(int)
        weekend_contact_counts: dict[str, int] = defaultdict(int)
        for conv in conversations.values():
            contact_name = conv.display_name or conv.chat_identifier
            messages = self._filter_conversation_messages(conv, data.year)
            for msg in messages:
                if not msg.is_from_me:
                    continue
                local_time = self._to_local_time(msg.timestamp)
                if local_time.weekday() < 5:
                    weekday_contact_counts[contact_name] += 1
                else:
                    weekend_contact_counts[contact_name] += 1

        weekday_mvp = max(
            weekday_contact_counts.items(), key=lambda item: item[1], default=(None, 0)
        )
        weekend_mvp = max(
            weekend_contact_counts.items(), key=lambda item: item[1], default=(None, 0)
        )

        weekday_info = (
            {"contact": weekday_mvp[0], "count": weekday_mvp[1]} if weekday_mvp[0] else None
        )
        weekend_info = (
            {"contact": weekend_mvp[0], "count": weekend_mvp[1]} if weekend_mvp[0] else None
        )

        return {
            "hour_distribution": sorted_hour,
            "day_of_week_distribution": sorted_day,
            "month_distribution": dict(sorted(month_distribution.items())),
            "busiest_hour": hour_distribution.most_common(1)[0] if hour_distribution else (None, 0),
            "weekday_percentage": round(weekday_counts / total_sent * 100, 2),
            "weekend_percentage": round(weekend_counts / total_sent * 100, 2),
            "weekday_mvp": weekday_info,
            "weekend_mvp": weekend_info,
        }

    def _analyze_streaks(
        self,
        data: ExportData,
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        max_streak = 0
        max_streak_contact = None
        max_streak_contact_id = None

        convs = conversations or data.conversations
        for conv in convs.values():
            messages = sorted(
                self._filter_conversation_messages(conv, data.year),
                key=lambda msg: msg.timestamp,
            )
            if not messages:
                continue
            messages = sorted(messages, key=lambda m: m.timestamp)

            dates = sorted(set(self._to_local_time(msg.timestamp).date() for msg in messages))

            current_streak = 1
            for i in range(1, len(dates)):
                if dates[i] - dates[i - 1] == timedelta(days=1):
                    current_streak += 1
                    if current_streak > max_streak:
                        max_streak = current_streak
                        max_streak_contact = conv.display_name or conv.chat_identifier
                        max_streak_contact_id = conv.chat_identifier
                else:
                    current_streak = 1

        return {
            "longest_streak_days": max_streak,
            "longest_streak_contact": max_streak_contact,
            "longest_streak_contact_id": max_streak_contact_id,
        }

    def _analyze_cliffhangers(
        self,
        data: ExportData,
        conversations: dict[str, Conversation],
    ) -> dict[str, Any]:
        threshold_hours = int(CLIFFHANGER_TIMEOUT.total_seconds() // 3600)

        def _longest_gap_for_sender(
            ordered_messages: list[Message], *, target_is_from_me: bool, contact_name: str
        ) -> dict[str, Any] | None:
            relevant = [
                msg
                for msg in ordered_messages
                if msg.is_from_me == target_is_from_me and (msg.text or "").strip()
            ]
            if len(relevant) < 2:
                return None

            winner: dict[str, Any] | None = None
            for idx in range(len(relevant) - 1):
                current = relevant[idx]
                next_message = relevant[idx + 1]
                gap = next_message.timestamp - current.timestamp
                if gap <= CLIFFHANGER_TIMEOUT:
                    continue

                snippet = (current.text or "").strip()
                lower_text = snippet.lower()
                matches_pattern = any(pattern in lower_text for pattern in CLIFFHANGER_PATTERNS)
                gap_seconds = gap.total_seconds()
                record = {
                    "contact": contact_name,
                    "timestamp": current.timestamp.isoformat(),
                    "snippet": snippet[:160],
                    "hours_waited": gap_seconds / 3600,
                    "gap_seconds": gap_seconds,
                    "matched_pattern": matches_pattern,
                }

                if winner is None:
                    winner = record
                    continue

                if gap_seconds > winner["gap_seconds"]:
                    winner = record
                    continue

                if (
                    gap_seconds == winner["gap_seconds"]
                    and matches_pattern
                    and not winner["matched_pattern"]
                ):
                    winner = record

            return winner

        example_candidates_you: list[dict[str, Any]] = []
        example_candidates_them: list[dict[str, Any]] = []
        total_you = 0
        total_them = 0

        for conv in conversations.values():
            messages = self._filter_conversation_messages(conv, data.year)
            if not messages:
                continue

            ordered = sorted(messages, key=lambda m: m.timestamp)
            contact_name = conv.display_name or conv.chat_identifier

            longest_you = _longest_gap_for_sender(
                ordered, target_is_from_me=True, contact_name=contact_name
            )
            if longest_you:
                total_you += 1
                example_candidates_you.append(longest_you)

            longest_them = _longest_gap_for_sender(
                ordered, target_is_from_me=False, contact_name=contact_name
            )
            if longest_them:
                total_them += 1
                example_candidates_them.append(longest_them)

        example_candidates_you.sort(key=lambda item: item["gap_seconds"], reverse=True)
        example_candidates_them.sort(key=lambda item: item["gap_seconds"], reverse=True)

        def _build_examples(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
            return [
                {
                    "contact": example["contact"],
                    "timestamp": example["timestamp"],
                    "snippet": example["snippet"],
                    "hours_waited": round(example["hours_waited"], 1),
                }
                for example in candidates[:3]
            ]

        longest_wait_you = (
            round(example_candidates_you[0]["hours_waited"], 1) if example_candidates_you else 0.0
        )
        longest_wait_them = (
            round(example_candidates_them[0]["hours_waited"], 1) if example_candidates_them else 0.0
        )

        return {
            "count": total_you,
            "count_them": total_them,
            "threshold_hours": threshold_hours,
            "examples": _build_examples(example_candidates_you),
            "examples_them": _build_examples(example_candidates_them),
            "longest_wait_hours": longest_wait_you,
            "longest_wait_hours_them": longest_wait_them,
        }

    def _analyze_contacts(
        self,
        data: ExportData,
        sent_messages: list[Message],
        received_messages: list[Message],
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        sent_by_contact = defaultdict(int)
        received_by_contact = defaultdict(int)
        contact_names = {}

        convs = conversations or data.conversations
        for conv in convs.values():
            contact_id = conv.chat_identifier
            contact_name = conv.display_name or contact_id
            contact_names[contact_id] = contact_name
            messages = self._filter_conversation_messages(conv, data.year)
            if not messages:
                continue
            for msg in messages:
                if msg.is_from_me:
                    sent_by_contact[contact_id] += 1
                else:
                    received_by_contact[contact_id] += 1

        top_sent = sorted(
            ((contact_names[cid], count) for cid, count in sent_by_contact.items()),
            key=lambda x: x[1],
            reverse=True,
        )[:10]

        top_received = sorted(
            ((contact_names[cid], count) for cid, count in received_by_contact.items()),
            key=lambda x: x[1],
            reverse=True,
        )[:10]

        unique_contacts_sent = len([c for c, count in sent_by_contact.items() if count > 0])
        unique_contacts_received = len([c for c, count in received_by_contact.items() if count > 0])

        contacts_by_date_sent = defaultdict(set)
        contacts_by_date_received = defaultdict(set)

        for conv in data.conversations.values():
            contact_id = conv.chat_identifier

            messages = self._filter_conversation_messages(conv, data.year)
            for msg in messages:
                local_time = self._to_local_time(msg.timestamp)
                if msg.is_from_me:
                    contacts_by_date_sent[local_time.date()].add(contact_id)
                else:
                    contacts_by_date_received[local_time.date()].add(contact_id)

        social_butterfly_day = max(
            contacts_by_date_sent.items(), key=lambda x: len(x[1]), default=(None, set())
        )

        fan_club_day = max(
            contacts_by_date_received.items(), key=lambda x: len(x[1]), default=(None, set())
        )

        total_messages_by_contact = {
            cid: sent_by_contact.get(cid, 0) + received_by_contact.get(cid, 0)
            for cid in contact_names.keys()
        }
        total_messages_considered = sum(total_messages_by_contact.values())

        # Build mapping of contact_id to is_group_chat
        is_group_chat_by_contact = {
            conv.chat_identifier: conv.is_group_chat for conv in convs.values()
        }
        participant_count_by_contact = {
            conv.chat_identifier: len(conv.participants or []) for conv in convs.values()
        }

        distribution = self._build_chat_concentration(
            total_messages=total_messages_considered,
            totals_by_contact=total_messages_by_contact,
            contact_names=contact_names,
            sent_by_contact=sent_by_contact,
            received_by_contact=received_by_contact,
            is_group_chat_by_contact=is_group_chat_by_contact,
            participant_count_by_contact=participant_count_by_contact,
            top_n=100,
        )

        return {
            "top_sent_to": [{"name": name, "count": count} for name, count in top_sent],
            "top_received_from": [{"name": name, "count": count} for name, count in top_received],
            "unique_contacts_messaged": unique_contacts_sent,
            "unique_contacts_received_from": unique_contacts_received,
            "social_butterfly_day": {
                "date": social_butterfly_day[0].isoformat() if social_butterfly_day[0] else None,
                "unique_contacts": len(social_butterfly_day[1]),
            },
            "fan_club_day": {
                "date": fan_club_day[0].isoformat() if fan_club_day[0] else None,
                "unique_contacts": len(fan_club_day[1]),
            },
            "message_distribution": distribution,
        }

    def _build_chat_concentration(
        self,
        *,
        total_messages: int,
        totals_by_contact: dict[str, int],
        contact_names: dict[str, str],
        sent_by_contact: dict[str, int] | None,
        received_by_contact: dict[str, int] | None,
        is_group_chat_by_contact: dict[str, bool] | None,
        participant_count_by_contact: dict[str, int] | None,
        top_n: int,
    ) -> list[dict[str, Any]]:
        if not totals_by_contact:
            return []

        sorted_contacts = sorted(
            totals_by_contact.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:top_n]

        denominator = max(total_messages, 1)
        cumulative = 0.0
        distribution = []

        for rank, (contact_id, count) in enumerate(sorted_contacts, start=1):
            share = round(count / denominator, 4)
            cumulative = round(cumulative + share, 4)
            sent_count = (sent_by_contact or {}).get(contact_id, 0)
            received_count = (received_by_contact or {}).get(contact_id, 0)
            sent_ratio = round(sent_count / max(count, 1), 4)
            received_ratio = round(received_count / max(count, 1), 4)
            is_group_chat = (is_group_chat_by_contact or {}).get(contact_id, False)
            participant_count = (participant_count_by_contact or {}).get(contact_id)
            distribution.append(
                {
                    "rank": rank,
                    "contact_id": contact_id,
                    "contact_name": contact_names.get(contact_id),
                    "share": share,
                    "count": count,
                    "sent_count": sent_count,
                    "received_count": received_count,
                    "sent_ratio": sent_ratio,
                    "received_ratio": received_ratio,
                    "cumulative_share": min(cumulative, 1.0),
                    "is_group_chat": is_group_chat,
                    "participant_count": participant_count,
                }
            )

        return distribution

    def _analyze_content(
        self,
        data: ExportData,
        sent_messages: list[Message],
        received_messages: list[Message],
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        def msg_length(message: Message) -> int:
            if hasattr(message, "text_length"):
                return getattr(message, "text_length") or 0
            return len(message.text or "")

        def msg_word_count(message: Message) -> int:
            if hasattr(message, "word_count"):
                return getattr(message, "word_count") or 0
            text = message.text or ""
            return len(text.split()) if text.strip() else 0

        def msg_punctuation_count(message: Message) -> int:
            if hasattr(message, "punctuation_count"):
                return getattr(message, "punctuation_count") or 0
            return len(re.findall(r'[.!?,;:\-\'"()]', message.text or ""))

        def msg_has_question(message: Message) -> bool:
            if hasattr(message, "has_question"):
                return bool(getattr(message, "has_question"))
            return "?" in (message.text or "")

        def msg_has_exclamation(message: Message) -> bool:
            if hasattr(message, "has_exclamation"):
                return bool(getattr(message, "has_exclamation"))
            return "!" in (message.text or "")

        def msg_has_link(message: Message) -> bool:
            if hasattr(message, "has_link"):
                return bool(getattr(message, "has_link"))
            return bool(re.search(r"https?://", message.text or ""))

        def msg_emoji_counts(message: Message) -> Counter[str]:
            counts = getattr(message, "emoji_counts", None)
            if counts:
                return Counter(counts)
            return count_emojis(message.text or "")

        sent_with_text = [m for m in sent_messages if msg_length(m) > 0]
        received_with_text = [m for m in received_messages if msg_length(m) > 0]

        emoji_counter: Counter[str] = Counter()
        sent_lengths: list[int] = []
        sent_word_counts: list[int] = []
        sent_punctuation_counts: list[int] = []
        received_punctuation_counts: list[int] = []
        question_count = 0
        exclamation_count = 0
        link_count = 0

        for msg in sent_with_text:
            sent_lengths.append(msg_length(msg))
            word_count = msg_word_count(msg)
            sent_word_counts.append(word_count)
            emoji_counter.update(msg_emoji_counts(msg))
            sent_punctuation_counts.append(msg_punctuation_count(msg))
            if msg_has_question(msg):
                question_count += 1
            if msg_has_exclamation(msg):
                exclamation_count += 1
            if msg_has_link(msg):
                link_count += 1

        for msg in received_with_text:
            received_punctuation_counts.append(msg_punctuation_count(msg))

        avg_length_sent = sum(sent_lengths) / len(sent_lengths) if sent_lengths else 0
        avg_length_received = (
            sum(msg_length(m) for m in received_with_text) / len(received_with_text)
            if received_with_text
            else 0
        )

        avg_punctuation_sent = (
            sum(sent_punctuation_counts) / len(sent_punctuation_counts)
            if sent_punctuation_counts
            else 0
        )
        avg_punctuation_received = (
            sum(received_punctuation_counts) / len(received_punctuation_counts)
            if received_punctuation_counts
            else 0
        )

        double_texts = self._count_double_texts(data, conversations)
        if getattr(data, "sentiment", None):
            sentiment_stats = data.sentiment
        else:
            # Only analyze sentiment for user's own messages (sent), not received
            sentiment_stats = self._analyze_sentiment(
                sent_messages,
                interval=self._sentiment_interval,
            )

        word_count_histogram = self._create_word_count_histogram(sent_word_counts)
        mode_word_count = Counter(sent_word_counts).most_common(1)[0][0] if sent_word_counts else 0
        avg_word_count_sent = (
            sum(sent_word_counts) / len(sent_word_counts) if sent_word_counts else 0
        )

        result = {
            "avg_message_length_sent": round(avg_length_sent, 2),
            "avg_message_length_received": round(avg_length_received, 2),
            "avg_word_count_sent": round(avg_word_count_sent, 2),
            "word_count_histogram": word_count_histogram,
            "mode_word_count": mode_word_count,
            "avg_punctuation_sent": round(avg_punctuation_sent, 2),
            "avg_punctuation_received": round(avg_punctuation_received, 2),
            "most_used_emojis": [
                {"emoji": emoji, "count": count} for emoji, count in emoji_counter.most_common(10)
            ],
            "questions_asked": question_count,
            "questions_percentage": (
                round(question_count / len(sent_with_text) * 100, 2) if sent_with_text else 0
            ),
            "exclamations_sent": exclamation_count,
            "enthusiasm_percentage": (
                round(exclamation_count / len(sent_with_text) * 100, 2) if sent_with_text else 0
            ),
            "links_shared": link_count,
            "attachments_sent": sum(1 for m in sent_messages if m.has_attachment),
            "attachments_received": sum(1 for m in received_messages if m.has_attachment),
            "double_text_count": double_texts["count"],
            "double_text_percentage": double_texts["percentage"],
            "quadruple_text_count": double_texts["quadruple_count"],
        }

        if sentiment_stats:
            result["sentiment"] = sentiment_stats
        phrase_public, phrase_contacts = self._get_phrases(
            data, sent_with_text, conversations=data.conversations
        )
        if phrase_public:
            result["phrases"] = phrase_public
        if phrase_contacts:
            result["_phrases_by_contact"] = phrase_contacts

        return result

    def _count_double_texts(
        self, data: ExportData, conversations: dict[str, Conversation] | None = None
    ) -> dict[str, Any]:
        total_sent = 0
        double_text_count = 0
        quadruple_text_count = 0

        convs = conversations or data.conversations

        for conv in convs.values():
            messages = self._filter_conversation_messages(conv, data.year)
            if not messages:
                continue

            total_sent += sum(1 for msg in messages if msg.is_from_me)

            i = 0
            while i < len(messages):
                current = messages[i]

                if not current.is_from_me:
                    i += 1
                    continue

                run_start_time = current.timestamp
                run_length = 1
                j = i + 1

                while (
                    j < len(messages)
                    and messages[j].is_from_me
                    and (messages[j].timestamp - run_start_time).total_seconds() < 300
                ):
                    run_length += 1
                    j += 1

                if run_length > 1:
                    double_text_count += 1
                if run_length >= 4:
                    quadruple_text_count += 1

                i = j

        percentage = round(double_text_count / total_sent * 100, 2) if total_sent else 0.0

        return {
            "count": double_text_count,
            "percentage": percentage,
            "quadruple_count": quadruple_text_count,
        }

    def _analyze_phrases(
        self,
        data: ExportData,
        sent_messages: list[Message],
        conversations: dict[str, Conversation] | None = None,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        extractor = getattr(self, "_phrase_extractor", None)
        if extractor is None or not sent_messages:
            return {}, []

        texts = [(msg.text or "").strip() for msg in sent_messages if (msg.text or "").strip()]
        if not texts:
            return {}, []

        per_contact_messages: dict[str, list[str]] = {}
        contact_names: dict[str, str] = {}

        convs = conversations or data.conversations
        for conv in convs.values():
            contact_id = conv.chat_identifier
            contact_names[contact_id] = conv.display_name or contact_id
            per_contact_texts = [
                (msg.text or "").strip()
                for msg in self._filter_conversation_messages(conv, data.year)
                if msg.is_from_me and (msg.text or "").strip()
            ]
            if per_contact_texts:
                per_contact_messages[contact_id] = per_contact_texts

        result = extractor.extract(
            texts,
            per_contact_messages=per_contact_messages or None,
            contact_names=contact_names or None,
        )

        if not result.overall:
            return {}, []

        def serialize_phrase(stat) -> dict[str, Any]:
            value = stat.text
            return {
                "phrase": value,
                "text": value,
                "occurrences": stat.occurrences,
                "share": stat.share,
            }

        overall = [serialize_phrase(stat) for stat in result.overall]
        by_contact = []
        for contact_stats in result.by_contact:
            if not contact_stats.top_phrases:
                continue
            by_contact.append(
                {
                    "contact_id": contact_stats.contact_id,
                    "contact_name": contact_stats.contact_name,
                    "total_messages": contact_stats.total_messages,
                    "top_phrases": [serialize_phrase(stat) for stat in contact_stats.top_phrases],
                }
            )

        config = result.config
        config_info = {
            "ngram_range": list(config.ngram_range),
            "min_occurrences": config.min_occurrences,
            "min_characters": config.min_characters,
            "min_text_messages": config.min_text_messages,
            "per_contact_min_text_messages": config.per_contact_min_text_messages,
            "max_phrases": config.max_phrases,
            "per_contact_limit": config.per_contact_limit,
            "scoring": config.scoring,
        }

        public_payload = {
            "overall": overall,
            "analyzed_messages": result.analyzed_messages,
            "config": config_info,
        }
        return public_payload, by_contact

    def _get_phrases(
        self,
        data: ExportData,
        sent_messages: list[Message],
        conversations: dict[str, Conversation] | None = None,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        # Prefer phrases precomputed at export time (no raw text needed).
        if getattr(data, "phrases", None) is not None:
            return data.phrases or {}, []

        # Fall back to live extraction only if text is available.
        has_text = any((msg.text or "").strip() for msg in sent_messages)
        if not has_text:
            return {}, []

        return self._analyze_phrases(data, sent_messages, conversations=conversations)

    def _analyze_sentiment(
        self,
        sent_messages: list[Message],
        interval: str = "month",
    ) -> dict[str, Any]:
        # Only analyze sentiment for user's own messages (sent), not received
        sent_bucket = self._score_sentiment_messages(sent_messages, interval, stage="sent")

        if sent_bucket["message_count"] == 0:
            return {}

        # Return sentiment data with "overall" pointing to sent messages
        # (since we only want to analyze the user's own sentiment, not received messages)
        sentiment = {
            "overall": self._public_sentiment_view(sent_bucket),
            "sent": self._public_sentiment_view(sent_bucket),
            "periods": {
                "interval": interval,
                "overall": self._format_period_trend(sent_bucket["period_totals"]),
                "sent": self._format_period_trend(sent_bucket["period_totals"]),
            },
        }
        return sentiment

    def _score_sentiment_messages(
        self,
        messages: list[Message],
        interval: str,
        stage: str,
    ) -> dict[str, Any]:
        distribution = {"positive": 0, "neutral": 0, "negative": 0}
        total_score = 0.0
        total_messages = 0.0
        period_totals: dict[str, dict[str, Any]] = {}

        scored_messages = [msg for msg in messages if (msg.text or "").strip()]
        total = len(scored_messages)
        self._report_sentiment_progress(stage, 0, max(total, 1))

        for idx, msg in enumerate(scored_messages, start=1):
            text = (msg.text or "").strip()
            result = self._run_sentiment(text)
            distribution[result.label] += 1
            total_score += result.score
            total_messages += 1

            period_key = self._period_key(msg.timestamp, interval)
            period_bucket = period_totals.setdefault(
                period_key,
                {
                    "sum": 0.0,
                    "count": 0,
                    "distribution": {"positive": 0, "neutral": 0, "negative": 0},
                },
            )
            period_bucket["sum"] += result.score
            period_bucket["count"] += 1
            period_bucket["distribution"][result.label] += 1

            self._report_sentiment_progress(stage, idx, max(total, 1))

        return {
            "distribution": distribution,
            "score_sum": total_score,
            "message_count": total_messages,
            "period_totals": period_totals,
        }

    def _report_sentiment_progress(self, stage: str, completed: int, total: int) -> None:
        if self._sentiment_progress and total:
            try:
                self._sentiment_progress(stage, completed, total)
            except Exception:  # pragma: no cover - best effort progress
                logger.debug("Sentiment progress callback failed", exc_info=True)

    def _clamp_sample_rate(self, value: Any) -> float:
        try:
            rate = float(value)
        except (TypeError, ValueError):
            return 1.0
        rate = max(0.0, min(1.0, rate))
        return rate if rate > 0 else 1.0

    def _run_sentiment(self, text: str) -> SentimentResult:
        return self._sentiment_analyzer.analyze(text)

    def _combine_sentiment_buckets(self, *buckets: dict[str, Any]) -> dict[str, Any]:
        distribution = {"positive": 0, "neutral": 0, "negative": 0}
        total_score = 0.0
        total_messages = 0
        period_totals: dict[str, dict[str, Any]] = {}

        for bucket in buckets:
            for label, count in bucket["distribution"].items():
                distribution[label] += count
            total_score += bucket["score_sum"]
            total_messages += bucket["message_count"]

            for period, values in bucket["period_totals"].items():
                period_bucket = period_totals.setdefault(
                    period,
                    {
                        "sum": 0.0,
                        "count": 0,
                        "distribution": {"positive": 0, "neutral": 0, "negative": 0},
                    },
                )
                period_bucket["sum"] += values["sum"]
                period_bucket["count"] += values["count"]
                for label, count in values["distribution"].items():
                    period_bucket["distribution"][label] += count

        return {
            "distribution": distribution,
            "score_sum": total_score,
            "message_count": total_messages,
            "period_totals": period_totals,
        }

    def _public_sentiment_view(self, bucket: dict[str, Any]) -> dict[str, Any]:
        avg_score = (
            round(bucket["score_sum"] / bucket["message_count"], 3)
            if bucket["message_count"]
            else 0.0
        )

        distribution = {
            "positive": int(round(bucket["distribution"]["positive"])),
            "neutral": int(round(bucket["distribution"]["neutral"])),
            "negative": int(round(bucket["distribution"]["negative"])),
        }

        return {
            "distribution": distribution,
            "avg_score": avg_score,
            "message_count": int(round(bucket["message_count"])),
        }

    def _format_period_trend(
        self, period_totals: dict[str, dict[str, Any]]
    ) -> list[dict[str, Any]]:
        trend = []
        for period in sorted(period_totals.keys()):
            values = period_totals[period]
            count = values["count"]
            if not count:
                continue
            avg = round(values["sum"] / count, 3)
            distribution = {
                "positive": int(round(values["distribution"]["positive"])),
                "neutral": int(round(values["distribution"]["neutral"])),
                "negative": int(round(values["distribution"]["negative"])),
            }
            trend.append(
                {
                    "period": period,
                    "avg_score": avg,
                    "message_count": int(round(count)),
                    "distribution": distribution,
                }
            )
        return trend

    def _period_key(self, timestamp: datetime, interval: str) -> str:
        interval = interval.lower()
        if interval == "month":
            return timestamp.strftime("%Y-%m")
        if interval == "week":
            iso = timestamp.isocalendar()
            return f"{iso.year}-W{iso.week:02d}"
        if interval == "day":
            return timestamp.strftime("%Y-%m-%d")
        raise ValueError(f"Unsupported sentiment interval: {interval}")

    def _build_sentiment_analyzer(self):
        return LexicalSentimentAnalyzer()

    def _filter_conversation_messages(
        self,
        conversation: Conversation,
        year: int,
    ) -> list[Message]:
        return [
            msg
            for msg in conversation.messages
            if self._should_include_message(msg, year, include_context=False)
        ]

    def _create_word_count_histogram(self, word_counts: list[int]) -> dict[str, int]:
        if not word_counts:
            return {}

        histogram = Counter()
        for count in word_counts:
            histogram[count] += 1

        return dict(histogram)

    def _analyze_top_conversation(
        self,
        data: ExportData,
        conversations: dict[str, Conversation] | None = None,
        word_limit: int = TOP_CONVERSATION_WORD_LIMIT,
    ) -> dict[str, Any] | None:
        convs = conversations or data.conversations
        if not convs:
            return None

        top_conversation = max(convs.values(), key=lambda c: c.message_count, default=None)
        if top_conversation is None or top_conversation.message_count == 0:
            return None

        messages = self._filter_conversation_messages(top_conversation, data.year)
        if not messages:
            return None
        messages = sorted(messages, key=lambda msg: msg.timestamp)

        word_usage = self._build_word_usage_breakdown(messages, top_n=word_limit)
        unique_phrases = self._build_unique_phrase_breakdown(
            messages, top_n=TOP_CONVERSATION_PHRASE_LIMIT
        )
        hourly = self._build_hourly_distribution(messages)
        daily = self._build_daily_activity(messages)
        starters = self._compute_conversation_starters(messages)
        enders = self._compute_conversation_enders(messages)

        first_ts = self._to_local_time(messages[0].timestamp)
        last_ts = self._to_local_time(messages[-1].timestamp)

        return {
            "name": top_conversation.display_name or top_conversation.chat_identifier,
            "is_group": top_conversation.is_group_chat,
            "participant_count": len(top_conversation.participants),
            "message_count": len(messages),
            "date_range": {
                "start": first_ts.date().isoformat(),
                "end": last_ts.date().isoformat(),
            },
            "word_usage": word_usage,
            "unique_phrases": unique_phrases,
            "hourly_distribution": hourly,
            "daily_activity": daily,
            "starter_analysis": starters,
            "ender_analysis": enders,
        }

    def _build_word_usage_breakdown(
        self,
        messages: list[Message],
        top_n: int,
    ) -> dict[str, Any]:
        sent_counter: Counter[str] = Counter()
        received_counter: Counter[str] = Counter()
        total_sent = 0
        total_received = 0

        for message in messages:
            tokens = self._tokenize_words(message.text or "")
            if not tokens:
                continue
            if message.is_from_me:
                sent_counter.update(tokens)
                total_sent += len(tokens)
            else:
                received_counter.update(tokens)
                total_received += len(tokens)

        unique_you, unique_them = self._compute_unique_words_tfidf(
            you_counter=sent_counter,
            them_counter=received_counter,
            total_you=total_sent,
            total_them=total_received,
            top_n=max(12, top_n),
        )

        return {
            "sent": self._format_word_counter(sent_counter, total_sent, top_n),
            "received": self._format_word_counter(received_counter, total_received, top_n),
            "total_sent_tokens": total_sent,
            "total_received_tokens": total_received,
            "unique_words": {
                "you": unique_you,
                "them": unique_them,
                "method": "tfidf-2doc",
            },
        }

    def _build_unique_phrase_breakdown(
        self,
        messages: list[Message],
        top_n: int,
    ) -> dict[str, Any] | None:
        you_counter, total_you = self._count_phrase_ngrams(messages, is_from_me=True)
        them_counter, total_them = self._count_phrase_ngrams(messages, is_from_me=False)
        unique_you, unique_them = self._compute_unique_phrases_tfidf(
            you_counter=you_counter,
            them_counter=them_counter,
            total_you=total_you,
            total_them=total_them,
            top_n=top_n,
        )

        if not unique_you and not unique_them:
            return None

        return {
            "you": unique_you,
            "them": unique_them,
            "method": "tfidf-2doc",
            "config": {
                "ngram_range": list(TOP_CONVERSATION_PHRASE_NGRAM_RANGE),
                "min_occurrences": TOP_CONVERSATION_PHRASE_MIN_OCCURRENCES,
                "min_characters": TOP_CONVERSATION_PHRASE_MIN_CHARACTERS,
            },
        }

    def _tokenize_words(self, text: str) -> list[str]:
        if not text:
            return []
        tokens = self._word_tokenizer.tokenize(text)
        filtered: list[str] = []
        for token in tokens:
            if len(token) < TOP_CONVERSATION_MIN_TOKEN_LENGTH:
                continue
            if token.isdigit():
                continue
            if token in self._word_stopwords:
                continue
            filtered.append(token)
        return filtered

    def _count_phrase_ngrams(
        self, messages: list[Message], *, is_from_me: bool
    ) -> tuple[Counter[str], int]:
        counts: Counter[str] = Counter()
        for message in messages:
            if message.is_from_me != is_from_me:
                continue
            tokens = self._word_tokenizer.tokenize(message.text or "")
            if not tokens:
                continue
            for phrase in self._generate_phrase_ngrams(tokens):
                counts[phrase] += 1

        filtered = Counter(
            {
                phrase: count
                for phrase, count in counts.items()
                if count >= TOP_CONVERSATION_PHRASE_MIN_OCCURRENCES
            }
        )
        return filtered, sum(filtered.values())

    def _generate_phrase_ngrams(self, tokens: Sequence[str]) -> list[str]:
        min_n, max_n = TOP_CONVERSATION_PHRASE_NGRAM_RANGE
        length = len(tokens)
        phrases: list[str] = []
        for n in range(min_n, max_n + 1):
            if length < n:
                continue
            for idx in range(length - n + 1):
                window = tokens[idx : idx + n]
                if not self._valid_phrase_window(window):
                    continue
                phrases.append(" ".join(window))
        return phrases

    def _valid_phrase_window(self, tokens: Sequence[str]) -> bool:
        if not tokens:
            return False
        characters = sum(len(token) for token in tokens)
        if characters < TOP_CONVERSATION_PHRASE_MIN_CHARACTERS:
            return False
        has_letter = any(any(char.isalpha() for char in token) for token in tokens)
        if not has_letter:
            return False
        if any(token in TOP_CONVERSATION_PHRASE_FILTER_BANK for token in tokens):
            return False
        if all(token in self._word_stopwords for token in tokens):
            return False
        return True

    def _format_word_counter(
        self, counter: Counter[str], total: int, top_n: int
    ) -> list[dict[str, Any]]:
        if not counter or total <= 0:
            return []
        most_common = counter.most_common(top_n)
        formatted = []
        for word, count in most_common:
            share = count / total if total else 0
            formatted.append({"word": word, "count": count, "share": round(share, 4)})
        return formatted

    def _compute_unique_words_tfidf(
        self,
        you_counter: Counter[str],
        them_counter: Counter[str],
        total_you: int,
        total_them: int,
        top_n: int,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        if total_you <= 0 and total_them <= 0:
            return ([], [])

        total_docs = 2

        def _idf(df: int) -> float:
            return log((total_docs + 1) / (df + 1)) + 1.0

        vocabulary = set(you_counter) | set(them_counter)
        you_scored: list[dict[str, Any]] = []
        them_scored: list[dict[str, Any]] = []

        for word in vocabulary:
            you_count = int(you_counter.get(word, 0))
            them_count = int(them_counter.get(word, 0))
            df = (1 if you_count > 0 else 0) + (1 if them_count > 0 else 0)
            if df == 0:
                continue
            idf = _idf(df)

            if you_count > 0 and total_you > 0:
                tf = you_count / total_you
                you_scored.append(
                    {
                        "word": word,
                        "count": you_count,
                        "score": tf * idf,
                        "other_count": them_count,
                    }
                )
            if them_count > 0 and total_them > 0:
                tf = them_count / total_them
                them_scored.append(
                    {
                        "word": word,
                        "count": them_count,
                        "score": tf * idf,
                        "other_count": you_count,
                    }
                )

        # Prefer terms that are both frequent for that speaker and rarer for the other.
        def _sort_key(entry: dict[str, Any]) -> tuple[float, int, str]:
            return (
                float(entry.get("score") or 0),
                -(int(entry.get("other_count") or 0)),
                entry["word"],
            )

        you_scored.sort(key=_sort_key, reverse=True)
        them_scored.sort(key=_sort_key, reverse=True)

        you_filtered = [
            e for e in you_scored if (e.get("count") or 0) > (e.get("other_count") or 0)
        ]
        them_filtered = [
            e for e in them_scored if (e.get("count") or 0) > (e.get("other_count") or 0)
        ]

        def _trim(entry: dict[str, Any]) -> dict[str, Any]:
            return {
                "word": entry["word"],
                "count": entry["count"],
                "other_count": entry.get("other_count") or 0,
                "score": round(float(entry["score"]), 6),
            }

        return (
            [_trim(e) for e in you_filtered[:top_n]],
            [_trim(e) for e in them_filtered[:top_n]],
        )

    def _compute_unique_phrases_tfidf(
        self,
        you_counter: Counter[str],
        them_counter: Counter[str],
        total_you: int,
        total_them: int,
        top_n: int,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        if total_you <= 0 and total_them <= 0:
            return ([], [])

        total_docs = 2

        def _idf(df: int) -> float:
            return log((total_docs + 1) / (df + 1)) + 1.0

        vocabulary = set(you_counter) | set(them_counter)
        you_scored: list[dict[str, Any]] = []
        them_scored: list[dict[str, Any]] = []

        for phrase in vocabulary:
            you_count = int(you_counter.get(phrase, 0))
            them_count = int(them_counter.get(phrase, 0))
            df = (1 if you_count > 0 else 0) + (1 if them_count > 0 else 0)
            if df == 0:
                continue
            idf = _idf(df)

            if you_count > 0 and total_you > 0:
                tf = you_count / total_you
                you_scored.append(
                    {
                        "phrase": phrase,
                        "count": you_count,
                        "score": tf * idf,
                        "other_count": them_count,
                    }
                )
            if them_count > 0 and total_them > 0:
                tf = them_count / total_them
                them_scored.append(
                    {
                        "phrase": phrase,
                        "count": them_count,
                        "score": tf * idf,
                        "other_count": you_count,
                    }
                )

        def _sort_key(entry: dict[str, Any]) -> tuple[float, int, str]:
            return (
                float(entry.get("score") or 0),
                -(int(entry.get("other_count") or 0)),
                entry["phrase"],
            )

        you_scored.sort(key=_sort_key, reverse=True)
        them_scored.sort(key=_sort_key, reverse=True)

        you_filtered = [
            e for e in you_scored if (e.get("count") or 0) > (e.get("other_count") or 0)
        ]
        them_filtered = [
            e for e in them_scored if (e.get("count") or 0) > (e.get("other_count") or 0)
        ]

        def _trim(entry: dict[str, Any]) -> dict[str, Any]:
            return {
                "phrase": entry["phrase"],
                "count": entry["count"],
                "other_count": entry.get("other_count") or 0,
                "score": round(float(entry["score"]), 6),
            }

        return (
            [_trim(e) for e in you_filtered[:top_n]],
            [_trim(e) for e in them_filtered[:top_n]],
        )

    def _build_hourly_distribution(self, messages: list[Message]) -> dict[str, Any]:
        sent = [0 for _ in range(24)]
        received = [0 for _ in range(24)]

        for message in messages:
            local_time = self._to_local_time(message.timestamp)
            hour = local_time.hour
            if message.is_from_me:
                sent[hour] += 1
            else:
                received[hour] += 1

        total = [sent[i] + received[i] for i in range(24)]
        max_value = max(total) if total else 0

        def _busiest_hour(counts: list[int]) -> int | None:
            if not counts:
                return None
            peak = max(counts)
            if peak == 0:
                return None
            return max(range(len(counts)), key=lambda idx: counts[idx])

        return {
            "sent": sent,
            "received": received,
            "total": total,
            "max_value": max_value,
            "busiest_hour_you": _busiest_hour(sent),
            "busiest_hour_them": _busiest_hour(received),
        }

    def _build_daily_activity(self, messages: list[Message]) -> dict[str, Any]:
        daily_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"sent": 0, "received": 0})

        for message in messages:
            local_date = self._to_local_time(message.timestamp).date().isoformat()
            if message.is_from_me:
                daily_totals[local_date]["sent"] += 1
            else:
                daily_totals[local_date]["received"] += 1

        series = []
        for date in sorted(daily_totals.keys()):
            counts = daily_totals[date]
            entry = {
                "date": date,
                "sent": counts["sent"],
                "received": counts["received"],
                "total": counts["sent"] + counts["received"],
            }
            series.append(entry)

        busiest = max(series, key=lambda item: item["total"], default=None) if series else None

        return {
            "series": series,
            "busiest_day": busiest,
            "total_days": len(series),
        }

    def _compute_conversation_starters(self, messages: list[Message]) -> dict[str, Any]:
        if not messages:
            return {
                "silence_threshold_hours": CONVERSATION_SESSION_GAP_HOURS,
                "total_sessions": 0,
                "you_started": 0,
                "they_started": 0,
                "you_start_rate": 0,
                "avg_gap_hours": 0,
                "max_gap_hours": 0,
            }

        threshold = timedelta(hours=CONVERSATION_SESSION_GAP_HOURS)
        total_sessions = 0
        you_started = 0
        they_started = 0
        you_streak = 0
        they_streak = 0
        longest_you_streak = 0
        longest_they_streak = 0
        session_gaps: list[float] = []
        last_message_time: datetime | None = None
        last_session_end: datetime | None = None
        session_examples: list[dict[str, Any]] = []
        max_gap_hours = 0.0
        max_gap_window: dict[str, Any] | None = None

        for message in messages:
            timestamp = message.timestamp
            is_new_session = False
            if last_message_time is None:
                is_new_session = True
            else:
                delta = timestamp - last_message_time
                if delta >= threshold or timestamp.date() != last_message_time.date():
                    is_new_session = True

            if is_new_session:
                if last_session_end is not None:
                    gap_hours = (timestamp - last_session_end).total_seconds() / 3600
                    if gap_hours > 0:
                        session_gaps.append(gap_hours)
                        if gap_hours > max_gap_hours:
                            max_gap_hours = gap_hours
                            max_gap_window = {
                                "ended_at": self._to_local_time(last_session_end).isoformat(),
                                "next_started_at": self._to_local_time(timestamp).isoformat(),
                            }
                total_sessions += 1
                if message.is_from_me:
                    you_started += 1
                    you_streak += 1
                    they_streak = 0
                    longest_you_streak = max(longest_you_streak, you_streak)
                else:
                    they_started += 1
                    they_streak += 1
                    you_streak = 0
                    longest_they_streak = max(longest_they_streak, they_streak)

                local_time = self._to_local_time(timestamp)
                if len(session_examples) < MAX_STARTER_EXAMPLES:
                    session_examples.append(
                        {
                            "started_at": local_time.isoformat(),
                            "started_by_you": message.is_from_me,
                            "hour": local_time.hour,
                            "weekday": local_time.strftime("%a"),
                        }
                    )

            last_message_time = timestamp
            last_session_end = timestamp

        you_rate = you_started / total_sessions if total_sessions else 0
        avg_gap = sum(session_gaps) / len(session_gaps) if session_gaps else 0

        return {
            "silence_threshold_hours": CONVERSATION_SESSION_GAP_HOURS,
            "total_sessions": total_sessions,
            "you_started": you_started,
            "they_started": they_started,
            "you_start_rate": round(you_rate, 3),
            "avg_gap_hours": round(avg_gap, 2),
            "max_gap_hours": round(max_gap_hours, 2),
            "longest_you_streak": longest_you_streak,
            "longest_they_streak": longest_they_streak,
            "session_examples": session_examples,
            "max_gap_window": max_gap_window,
        }

    def _compute_conversation_enders(self, messages: list[Message]) -> dict[str, Any]:
        if not messages:
            return {
                "silence_threshold_hours": CONVERSATION_SESSION_GAP_HOURS,
                "total_sessions": 0,
                "you_ended": 0,
                "they_ended": 0,
                "you_end_rate": 0,
            }

        threshold = timedelta(hours=CONVERSATION_SESSION_GAP_HOURS)
        total_sessions = 0
        you_ended = 0
        they_ended = 0
        end_examples: list[dict[str, Any]] = []

        def _is_session_break(prev: datetime, nxt: datetime) -> bool:
            if nxt - prev >= threshold:
                return True
            if nxt.date() != prev.date():
                return True
            return False

        for idx, message in enumerate(messages):
            is_last_message = idx == len(messages) - 1
            ended_here = (
                True
                if is_last_message
                else _is_session_break(message.timestamp, messages[idx + 1].timestamp)
            )

            if not ended_here:
                continue

            total_sessions += 1
            if message.is_from_me:
                you_ended += 1
            else:
                they_ended += 1

            if len(end_examples) < MAX_STARTER_EXAMPLES:
                local_time = self._to_local_time(message.timestamp)
                end_examples.append(
                    {
                        "ended_at": local_time.isoformat(),
                        "ended_by_you": message.is_from_me,
                        "hour": local_time.hour,
                        "weekday": local_time.strftime("%a"),
                    }
                )

        you_rate = you_ended / total_sessions if total_sessions else 0
        return {
            "silence_threshold_hours": CONVERSATION_SESSION_GAP_HOURS,
            "total_sessions": total_sessions,
            "you_ended": you_ended,
            "they_ended": they_ended,
            "you_end_rate": round(you_rate, 3),
            "end_examples": end_examples,
        }

    def _analyze_conversations(
        self,
        data: ExportData,
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        convs = conversations or data.conversations
        group_chats = [c for c in convs.values() if c.is_group_chat]
        one_on_one = [c for c in convs.values() if not c.is_group_chat]

        group_message_count = sum(c.message_count for c in group_chats)
        one_on_one_message_count = sum(c.message_count for c in one_on_one)
        total = group_message_count + one_on_one_message_count

        most_active = max(convs.values(), key=lambda c: c.message_count, default=None)

        most_active_group = (
            max(group_chats, key=lambda c: c.message_count, default=None) if group_chats else None
        )

        return {
            "total_conversations": len(convs),
            "group_chats": len(group_chats),
            "one_on_one_chats": len(one_on_one),
            "group_vs_1on1_ratio": {
                "group_percentage": round(group_message_count / total * 100, 2) if total > 0 else 0,
                "one_on_one_percentage": round(one_on_one_message_count / total * 100, 2)
                if total > 0
                else 0,
            },
            "most_active_thread": {
                "name": most_active.display_name or most_active.chat_identifier
                if most_active
                else None,
                "message_count": most_active.message_count if most_active else 0,
                "is_group": most_active.is_group_chat if most_active else False,
            },
            "most_active_group_chat": {
                "name": most_active_group.display_name or most_active_group.chat_identifier
                if most_active_group
                else None,
                "message_count": most_active_group.message_count if most_active_group else 0,
            }
            if most_active_group
            else None,
        }

    def _analyze_ghosts(
        self,
        conversations: dict[str, Conversation],
        data: ExportData,
    ) -> dict[str, Any]:
        stats = compute_ghost_stats(
            conversations.values(),
            year=data.year,
            timeline=self._ghost_timeline,
            min_consecutive_messages=self._ghost_min_consecutive,
            min_conversation_messages=self._ghost_min_conversation_messages,
            reference_time=data.export_date,
            include_group_chats=self._include_group_chats_in_ghosts,
        )
        ratio = None
        if stats.ghosted_you_count:
            ratio = round(stats.you_ghosted_count / stats.ghosted_you_count, 2)

        timeline_days = max(int(self._ghost_timeline.total_seconds() // 86400), 1)

        return {
            "timeline_days": timeline_days,
            "min_consecutive_messages": self._ghost_min_consecutive,
            "min_conversation_messages": self._ghost_min_conversation_messages,
            "people_you_left_hanging": stats.you_ghosted_count,
            "people_who_left_you_hanging": stats.ghosted_you_count,
            "ghost_ratio": ratio,
        }

    def _analyze_response_times(
        self,
        data: ExportData,
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        response_times_you = []
        response_times_them = []

        convs = conversations or data.conversations
        for conv in convs.values():
            # Skip group chats - response dynamics are different
            if conv.is_group_chat:
                continue
            messages = self._filter_conversation_messages(conv, data.year)
            if len(messages) < 2:
                continue
            messages = sorted(messages, key=lambda m: m.timestamp)

            for i in range(len(messages) - 1):
                current = messages[i]
                next_msg = messages[i + 1]

                time_diff_seconds = (next_msg.timestamp - current.timestamp).total_seconds()

                if current.is_from_me and not next_msg.is_from_me:
                    response_times_them.append(time_diff_seconds)
                elif not current.is_from_me and next_msg.is_from_me:
                    response_times_you.append(time_diff_seconds)

        def format_duration(seconds: float) -> str:
            if seconds < 60:
                return f"{int(seconds)}s"
            elif seconds < 3600:
                return f"{int(seconds // 60)}m {int(seconds % 60)}s"
            elif seconds < 86400:
                hours = int(seconds // 3600)
                minutes = int((seconds % 3600) // 60)
                return f"{hours}h {minutes}m"
            else:
                days = int(seconds // 86400)
                hours = int((seconds % 86400) // 3600)
                return f"{days}d {hours}h"

        def calculate_median(times: list[float]) -> float:
            if not times:
                return 0
            sorted_times = sorted(times)
            n = len(sorted_times)
            if n % 2 == 0:
                return (sorted_times[n // 2 - 1] + sorted_times[n // 2]) / 2
            return sorted_times[n // 2]

        median_response_you = calculate_median(response_times_you)
        median_response_them = calculate_median(response_times_them)

        return {
            "median_response_time_you_seconds": round(median_response_you, 2),
            "median_response_time_you_formatted": format_duration(median_response_you),
            "median_response_time_them_seconds": round(median_response_them, 2),
            "median_response_time_them_formatted": format_duration(median_response_them),
            "total_responses_you": len(response_times_you),
            "total_responses_them": len(response_times_them),
        }

    def _analyze_crashout(
        self,
        data: ExportData,
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        best_streak: dict[str, Any] | None = None
        total_streaks = 0
        total_length = 0
        total_score = 0.0

        convs = conversations or data.conversations
        for conv in convs.values():
            if conv.is_group_chat:
                continue
            messages = self._filter_conversation_messages(conv, data.year)
            if len(messages) < CRASHOUT_MIN_STREAK:
                continue
            messages = sorted(messages, key=lambda m: m.timestamp)
            current_streak: list[Message] = []

            def finalize_streak(streak: list[Message]) -> None:
                nonlocal best_streak, total_streaks, total_length, total_score
                stats = self._score_crashout_streak(streak)
                if not stats:
                    return
                total_streaks += 1
                total_length += stats["streak_length"]
                total_score += stats["score"]
                if best_streak is None or stats["score"] > best_streak["score"]:
                    best_streak = stats

            for msg in messages:
                if msg.is_from_me:
                    current_streak.append(msg)
                else:
                    finalize_streak(current_streak)
                    current_streak = []

            finalize_streak(current_streak)

        if total_streaks == 0 or best_streak is None:
            return {
                "min_streak": CRASHOUT_MIN_STREAK,
                "max_window_minutes": int(CRASHOUT_MAX_WINDOW.total_seconds() // 60),
                "streaks_count": 0,
                "avg_streak_length": 0,
                "avg_score": 0.0,
                "peak_score": 0.0,
                "meter": 0,
                "peak_streak_length": 0,
                "peak_streak_window_minutes": 0.0,
                "peak_negative_ratio": 0.0,
                "peak_exclamation_ratio": 0.0,
                "peak_avg_sentiment": 0.0,
            }

        peak_score = best_streak["score"]
        meter = min(100, int(round(peak_score * CRASHOUT_SCORE_MULTIPLIER)))

        return {
            "min_streak": CRASHOUT_MIN_STREAK,
            "max_window_minutes": int(CRASHOUT_MAX_WINDOW.total_seconds() // 60),
            "streaks_count": total_streaks,
            "avg_streak_length": round(total_length / total_streaks, 1),
            "avg_score": round(total_score / total_streaks, 2),
            "peak_score": round(peak_score, 2),
            "meter": meter,
            "peak_streak_length": best_streak["streak_length"],
            "peak_streak_window_minutes": round(best_streak["duration_minutes"], 1),
            "peak_negative_ratio": round(best_streak["negative_ratio"], 2),
            "peak_exclamation_ratio": round(best_streak["exclamation_ratio"], 2),
            "peak_avg_sentiment": round(best_streak["avg_sentiment_score"], 3),
        }

    def _analyze_tapbacks(
        self,
        all_messages: list[Message],
        sent_messages: list[Message],
        received_messages: list[Message],
    ) -> dict[str, Any]:
        tapbacks_given = []
        tapbacks_received = []

        for msg in all_messages:
            for tapback in msg.tapbacks:
                if tapback.by == "Me":
                    tapbacks_given.append(tapback.type)
                else:
                    tapbacks_received.append(tapback.type)

        tapback_counter_given = Counter(tapbacks_given)
        tapback_counter_received = Counter(tapbacks_received)

        all_tapback_types = ["love", "like", "dislike", "laugh", "emphasize", "question"]
        tapback_distribution_given = {t: tapback_counter_given.get(t, 0) for t in all_tapback_types}
        tapback_distribution_received = {
            t: tapback_counter_received.get(t, 0) for t in all_tapback_types
        }

        return {
            "total_tapbacks_given": len(tapbacks_given),
            "total_tapbacks_received": len(tapbacks_received),
            "favorite_tapback": tapback_counter_given.most_common(1)[0]
            if tapback_counter_given
            else (None, 0),
            "most_received_tapback": tapback_counter_received.most_common(1)[0]
            if tapback_counter_received
            else (None, 0),
            "tapback_distribution_given": tapback_distribution_given,
            "tapback_distribution_received": tapback_distribution_received,
        }

    def _score_crashout_streak(self, streak: list[Message]) -> dict[str, Any] | None:
        if len(streak) < CRASHOUT_MIN_STREAK:
            return None

        start = streak[0].timestamp
        end = streak[-1].timestamp
        duration_seconds = max((end - start).total_seconds(), 0.0)

        negative_count = 0
        exclamation_count = 0
        sentiment_total = 0.0
        sentiment_scored = 0

        for msg in streak:
            if msg.has_exclamation:
                exclamation_count += 1
            text = (msg.text or "").strip()
            if text:
                result = self._sentiment_analyzer.analyze(text)
                if result.label == "negative":
                    negative_count += 1
                sentiment_total += result.score
                sentiment_scored += 1

        streak_length = len(streak)
        negative_ratio = negative_count / streak_length if streak_length else 0.0
        exclamation_ratio = exclamation_count / streak_length if streak_length else 0.0
        avg_sentiment = sentiment_total / sentiment_scored if sentiment_scored else 0.0

        window_seconds = CRASHOUT_MAX_WINDOW.total_seconds()
        if duration_seconds <= window_seconds:
            time_factor = 1.0 + (window_seconds - duration_seconds) / window_seconds
        else:
            time_factor = 1.0

        negative_weight = 1.0 + min(1.5, negative_ratio * 1.5)
        exclamation_weight = 1.0 + min(0.5, exclamation_ratio * 0.5)

        score = streak_length * negative_weight * exclamation_weight * time_factor

        return {
            "streak_length": streak_length,
            "duration_seconds": duration_seconds,
            "duration_minutes": duration_seconds / 60.0,
            "negative_ratio": negative_ratio,
            "exclamation_ratio": exclamation_ratio,
            "avg_sentiment_score": avg_sentiment,
            "score": score,
        }


class NLPStatisticsAnalyzer(StatisticsAnalyzer):
    @property
    def name(self) -> str:
        return "nlp"

    def analyze(self, data: ExportData) -> dict[str, Any]:
        return {
            "status": "not_implemented",
            "message": "NLP analysis requires additional dependencies (spaCy, NLTK)",
            "planned_features": [
                "sentiment_analysis",
                "topic_clustering",
                "word_frequency_analysis",
                "linguistic_patterns",
                "named_entity_extraction",
            ],
        }

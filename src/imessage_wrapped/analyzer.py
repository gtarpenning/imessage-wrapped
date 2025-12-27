import logging
import re
from abc import ABC, abstractmethod
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
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

        return {
            "volume": self._analyze_volume(all_messages, sent_messages, received_messages),
            "temporal": self._analyze_temporal_patterns(data, sent_messages, conversations),
            "contacts": self._analyze_contacts(
                data, sent_messages, received_messages, conversations=conversations
            ),
            "content": self._analyze_content(
                data, sent_messages, received_messages, conversations=conversations
            ),
            "conversations": self._analyze_conversations(data, conversations=conversations),
            "response_times": self._analyze_response_times(data, conversations=conversations),
            "tapbacks": self._analyze_tapbacks(
                all_messages_with_context, sent_messages, received_messages
            ),
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
            messages = self._filter_conversation_messages(conv, data.year)
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

        distribution = self._build_chat_concentration(
            total_messages=total_messages_considered,
            totals_by_contact=total_messages_by_contact,
            contact_names=contact_names,
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
            distribution.append(
                {
                    "rank": rank,
                    "contact_id": contact_id,
                    "contact_name": contact_names.get(contact_id),
                    "share": share,
                    "count": count,
                    "cumulative_share": min(cumulative, 1.0),
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
        sent_with_text = [m for m in sent_messages if m.text]
        received_with_text = [m for m in received_messages if m.text]

        punctuation_pattern = re.compile(r'[.!?,;:\-\'"()]')

        emoji_counter: Counter[str] = Counter()
        sent_lengths: list[int] = []
        sent_word_counts: list[int] = []
        sent_punctuation_counts: list[int] = []
        received_punctuation_counts: list[int] = []
        question_count = 0
        exclamation_count = 0
        link_count = 0

        for msg in sent_with_text:
            text = msg.text or ""
            sent_lengths.append(len(text))
            word_count = len(text.split()) if text.strip() else 0
            sent_word_counts.append(word_count)
            emoji_counter.update(count_emojis(text))
            sent_punctuation_counts.append(len(punctuation_pattern.findall(text)))
            if "?" in text:
                question_count += 1
            if "!" in text:
                exclamation_count += 1
            if re.search(r"https?://", text):
                link_count += 1

        for msg in received_with_text:
            text = msg.text or ""
            received_punctuation_counts.append(len(punctuation_pattern.findall(text)))

        avg_length_sent = sum(sent_lengths) / len(sent_lengths) if sent_lengths else 0
        avg_length_received = (
            sum(len(m.text or "") for m in received_with_text) / len(received_with_text)
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

        double_texts = self._count_double_texts(sent_messages)
        sentiment_stats = self._analyze_sentiment(
            sent_messages,
            received_messages,
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
        }

        if sentiment_stats:
            result["sentiment"] = sentiment_stats
        phrase_public, phrase_contacts = self._analyze_phrases(
            data, sent_with_text, conversations=data.conversations
        )
        if phrase_public:
            result["phrases"] = phrase_public
        if phrase_contacts:
            result["_phrases_by_contact"] = phrase_contacts

        return result

    def _count_double_texts(self, sent_messages: list[Message]) -> dict[str, Any]:
        if not sent_messages:
            return {"count": 0, "percentage": 0.0}

        sorted_msgs = sorted(sent_messages, key=lambda m: m.timestamp)

        double_text_count = 0
        i = 0
        while i < len(sorted_msgs) - 1:
            current = sorted_msgs[i]
            next_msg = sorted_msgs[i + 1]

            time_diff = (next_msg.timestamp - current.timestamp).total_seconds()

            if time_diff < 300:
                double_text_count += 1
                while (
                    i < len(sorted_msgs) - 1
                    and (sorted_msgs[i + 1].timestamp - current.timestamp).total_seconds() < 300
                ):
                    i += 1
            i += 1

        percentage = round(double_text_count / len(sorted_msgs) * 100, 2) if sorted_msgs else 0

        return {
            "count": double_text_count,
            "percentage": percentage,
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

    def _analyze_sentiment(
        self,
        sent_messages: list[Message],
        received_messages: list[Message],
        interval: str = "month",
    ) -> dict[str, Any]:
        sent_bucket = self._score_sentiment_messages(sent_messages, interval, stage="sent")
        received_bucket = self._score_sentiment_messages(
            received_messages, interval, stage="received"
        )
        overall_bucket = self._combine_sentiment_buckets(sent_bucket, received_bucket)

        if overall_bucket["message_count"] == 0:
            return {}

        sentiment = {
            "overall": self._public_sentiment_view(overall_bucket),
            "sent": self._public_sentiment_view(sent_bucket),
            "received": self._public_sentiment_view(received_bucket),
            "periods": {
                "interval": interval,
                "overall": self._format_period_trend(overall_bucket["period_totals"]),
                "sent": self._format_period_trend(sent_bucket["period_totals"]),
                "received": self._format_period_trend(received_bucket["period_totals"]),
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

        return {
            "total_tapbacks_given": len(tapbacks_given),
            "total_tapbacks_received": len(tapbacks_received),
            "favorite_tapback": tapback_counter_given.most_common(1)[0]
            if tapback_counter_given
            else (None, 0),
            "most_received_tapback": tapback_counter_received.most_common(1)[0]
            if tapback_counter_received
            else (None, 0),
            "tapback_distribution_given": dict(tapback_counter_given.most_common()),
            "tapback_distribution_received": dict(tapback_counter_received.most_common()),
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

import hashlib
import logging
import os
import re
from abc import ABC, abstractmethod
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Optional, Sequence

from .ghost import (
    ConversationFilter,
    apply_conversation_filters,
    compute_ghost_stats,
    minimum_responses_filter,
    received_to_sent_ratio_filter,
)
from .models import Conversation, ExportData, Message
from .phrases import PhraseExtractionConfig, PhraseExtractor
from .sentiment import (
    DistilBertOnnxSentimentAnalyzer,
    LexicalSentimentAnalyzer,
    SentimentResult,
)


class StatisticsAnalyzer(ABC):
    @abstractmethod
    def analyze(self, data: ExportData) -> dict[str, Any]:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass


logger = logging.getLogger(__name__)


class RawStatisticsAnalyzer(StatisticsAnalyzer):
    def __init__(
        self,
        sentiment_backend: str | None = None,
        sentiment_progress: Optional[Callable[[str, int, int], None]] = None,
        phrase_config: PhraseExtractionConfig | None = None,
        ghost_timeline_days: int = 30,
        conversation_filters: Sequence[ConversationFilter] | None = None,
        include_group_chats_in_ghosts: bool = False,
    ) -> None:
        backend = sentiment_backend or os.getenv("IMESSAGE_WRAPPED_SENTIMENT_BACKEND", "lexical")
        self._sentiment_backend = backend.lower()
        self._sentiment_analyzer = self._build_sentiment_analyzer(self._sentiment_backend)
        self._sentiment_interval = "month"
        self._sentiment_progress = sentiment_progress
        self._sentiment_model_info = getattr(self._sentiment_analyzer, "model_info", None)
        raw_rate = getattr(self._sentiment_analyzer, "sample_rate", None)
        if raw_rate is None:
            raw_rate = getattr(self._sentiment_analyzer, "embedding_sample_rate", 1.0)
        self._sentiment_sample_rate = self._clamp_sample_rate(raw_rate)
        self._embedding_sample_rate = getattr(
            self._sentiment_analyzer, "embedding_sample_rate", self._sentiment_sample_rate
        )
        self._sentiment_axes_cache: list[dict[str, Any]] | None = None
        self._phrase_extractor = PhraseExtractor(config=phrase_config)

        if ghost_timeline_days <= 0:
            raise ValueError("ghost_timeline_days must be a positive integer")
        self._ghost_timeline = timedelta(days=ghost_timeline_days)
        self._include_group_chats_in_ghosts = include_group_chats_in_ghosts

        if conversation_filters is None:
            conversation_filters = (
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
            "temporal": self._analyze_temporal_patterns(all_messages, sent_messages),
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

    def _analyze_volume(
        self,
        all_messages: list[Message],
        sent_messages: list[Message],
        received_messages: list[Message],
    ) -> dict[str, Any]:
        sent_by_date = defaultdict(int)
        received_by_date = defaultdict(int)

        for msg in sent_messages:
            sent_by_date[msg.timestamp.date()] += 1

        for msg in received_messages:
            received_by_date[msg.timestamp.date()] += 1

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
        self, all_messages: list[Message], sent_messages: list[Message]
    ) -> dict[str, Any]:
        hour_distribution = Counter(msg.timestamp.hour for msg in sent_messages)
        day_of_week_distribution = Counter(msg.timestamp.weekday() for msg in sent_messages)
        month_distribution = Counter(msg.timestamp.month for msg in sent_messages)

        return {
            "hour_distribution": dict(sorted(hour_distribution.items())),
            "day_of_week_distribution": dict(sorted(day_of_week_distribution.items())),
            "month_distribution": dict(sorted(month_distribution.items())),
            "busiest_hour": hour_distribution.most_common(1)[0] if hour_distribution else (None, 0),
            "busiest_day_of_week": day_of_week_distribution.most_common(1)[0]
            if day_of_week_distribution
            else (None, 0),
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

            dates = sorted(set(msg.timestamp.date() for msg in messages))

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
                if msg.is_from_me:
                    contacts_by_date_sent[msg.timestamp.date()].add(contact_id)
                else:
                    contacts_by_date_received[msg.timestamp.date()].add(contact_id)

        social_butterfly_day = max(
            contacts_by_date_sent.items(), key=lambda x: len(x[1]), default=(None, set())
        )

        fan_club_day = max(
            contacts_by_date_received.items(), key=lambda x: len(x[1]), default=(None, set())
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
        }

    def _analyze_content(
        self,
        data: ExportData,
        sent_messages: list[Message],
        received_messages: list[Message],
        conversations: dict[str, Conversation] | None = None,
    ) -> dict[str, Any]:
        sent_with_text = [m for m in sent_messages if m.text]
        received_with_text = [m for m in received_messages if m.text]

        emoji_pattern = re.compile(
            "["
            "\U0001f600-\U0001f64f"  # emoticons
            "\U0001f300-\U0001f5ff"  # symbols & pictographs
            "\U0001f680-\U0001f6ff"  # transport & map
            "\U0001f1e0-\U0001f1ff"  # flags
            "\U00002702-\U000027b0"
            "\U000024c2-\U0001f251"
            "]+",
            flags=re.UNICODE,
        )

        punctuation_pattern = re.compile(r'[.!?,;:\-\'"()]')

        sent_emojis = []
        sent_lengths = []
        sent_punctuation_counts = []
        received_punctuation_counts = []
        question_count = 0
        exclamation_count = 0
        link_count = 0

        for msg in sent_with_text:
            text = msg.text or ""
            sent_lengths.append(len(text))
            found_emojis = emoji_pattern.findall(text)
            filtered_emojis = [
                e
                for e in found_emojis
                if "\ufffc" not in e
                and e not in ["\u2642\ufe0f", "\u2640\ufe0f", "\u2642", "\u2640", "\ufe0f"]
            ]
            sent_emojis.extend(filtered_emojis)
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

        emoji_counter = Counter(sent_emojis)

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

        result = {
            "avg_message_length_sent": round(avg_length_sent, 2),
            "avg_message_length_received": round(avg_length_received, 2),
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
            return {
                "text": stat.text,
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
        received_bucket = self._score_sentiment_messages(received_messages, interval, stage="received")
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
        scatter = self._compose_embedding_scatter(sent_bucket, received_bucket)
        if scatter:
            sentiment["scatter"] = scatter
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
        embeddings: list[dict[str, Any]] = []
        axis_ids = self._sentiment_axis_ids()
        can_project = (
            hasattr(self._sentiment_analyzer, "project_embedding")
            and len(axis_ids) >= 2
            and self._embedding_sample_rate > 0
        )
        sample_rate = self._sentiment_sample_rate
        use_sampling = 0 < sample_rate < 1
        selected_counts: dict[tuple[str, str], int] = defaultdict(int)
        period_message_counts: dict[tuple[str, str], int] = defaultdict(int)

        scored_messages = [msg for msg in messages if (msg.text or "").strip()]
        selections: list[tuple[Message, str, bool]] = []
        for msg in scored_messages:
            period_key = self._period_key(msg.timestamp, interval)
            period_message_counts[(stage, period_key)] += 1
            include_msg = True
            if use_sampling:
                include_msg = self._should_sample_sentiment(msg, stage, period_key)
                if not include_msg and selected_counts[(stage, period_key)] == 0:
                    include_msg = True
            if include_msg:
                selected_counts[(stage, period_key)] += 1
            selections.append((msg, period_key, include_msg))

        selected_total = sum(1 for _, _, include in selections if include)
        effective_total = selected_total if selected_total else len(scored_messages)
        self._report_sentiment_progress(stage, 0, max(effective_total, 1))

        processed_selected = 0

        for msg, period_key, include_msg in selections:
            if not include_msg:
                continue

            text = (msg.text or "").strip()
            result, embedding = self._run_sentiment(text)
            if use_sampling:
                selected_in_period = selected_counts.get((stage, period_key), 0) or 1
                total_in_period = period_message_counts.get((stage, period_key), 0) or 1
                weight = total_in_period / selected_in_period
            else:
                weight = 1.0
            distribution[result.label] += weight
            total_score += result.score * weight
            total_messages += weight

            period_bucket = period_totals.setdefault(
                period_key,
                {
                    "sum": 0.0,
                    "count": 0,
                    "distribution": {"positive": 0, "neutral": 0, "negative": 0},
                },
            )
            period_bucket["sum"] += result.score * weight
            period_bucket["count"] += weight
            period_bucket["distribution"][result.label] += weight
            if (
                can_project
                and embedding is not None
                and self._should_sample_embedding(msg, stage, period_key)
            ):
                coords = self._project_embedding(embedding)
                if coords:
                    embeddings.append(
                        {
                            "stage": stage,
                            "period": period_key,
                            "score": round(result.score, 3),
                            "x": coords.get(axis_ids[0], 0.0),
                            "y": coords.get(axis_ids[1], 0.0),
                        }
                    )
            processed_selected += 1
            self._report_sentiment_progress(
                stage, processed_selected, max(effective_total, 1)
            )

        return {
            "distribution": distribution,
            "score_sum": total_score,
            "message_count": total_messages,
            "period_totals": period_totals,
            "embeddings": embeddings,
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

    def _run_sentiment(self, text: str) -> tuple[SentimentResult, Sequence[float] | None]:
        analyzer = self._sentiment_analyzer
        if hasattr(analyzer, "analyze_with_embedding"):
            return analyzer.analyze_with_embedding(text)
        return analyzer.analyze(text), None

    def _sentiment_axis_metadata(self) -> list[dict[str, Any]]:
        if self._sentiment_axes_cache is not None:
            return self._sentiment_axes_cache
        info = getattr(self._sentiment_analyzer, "model_info", {}) or {}
        seeds = info.get("axis_seeds") or []
        axes = [
            {"id": axis_id, "label": axis_id, "seed": phrase} for axis_id, phrase in seeds
        ]
        self._sentiment_axes_cache = axes
        return axes

    def _sentiment_axis_ids(self) -> list[str]:
        return [axis["id"] for axis in self._sentiment_axis_metadata()]

    def _project_embedding(self, embedding: Sequence[float]) -> dict[str, float]:
        analyzer = self._sentiment_analyzer
        if hasattr(analyzer, "project_embedding"):
            return analyzer.project_embedding(embedding)
        return {}

    def _should_sample_sentiment(self, message: Message, stage: str, period_key: str) -> bool:
        return self._deterministic_sample(
            self._sentiment_sample_rate, message, stage, period_key, "sentiment"
        )

    def _should_sample_embedding(self, message: Message, stage: str, period_key: str) -> bool:
        return self._deterministic_sample(
            self._embedding_sample_rate, message, stage, period_key, "embedding"
        )

    def _deterministic_sample(
        self,
        rate: float,
        message: Message,
        stage: str,
        period_key: str,
        tag: str,
    ) -> bool:
        if rate >= 1:
            return True
        if rate <= 0:
            return False
        seed = f"{tag}:{message.guid}:{stage}:{period_key}:{message.timestamp.isoformat()}"
        digest = hashlib.sha256(seed.encode("utf-8")).digest()
        value = int.from_bytes(digest[:8], "big") / float(1 << 64)
        return value <= rate

    def _compose_embedding_scatter(
        self, sent_bucket: dict[str, Any], received_bucket: dict[str, Any]
    ) -> dict[str, Any] | None:
        axes = self._sentiment_axis_metadata()
        if len(axes) < 2:
            return None
        points: list[dict[str, Any]] = []
        for bucket in (sent_bucket, received_bucket):
            points.extend(bucket.get("embeddings", []))
        if not points:
            return None
        scatter: dict[str, Any] = {
            "axes": axes,
            "points": points,
        }
        if self._sentiment_sample_rate:
            scatter["sample_rate"] = self._sentiment_sample_rate
        return scatter

    def _combine_sentiment_buckets(self, *buckets: dict[str, Any]) -> dict[str, Any]:
        distribution = {"positive": 0, "neutral": 0, "negative": 0}
        total_score = 0.0
        total_messages = 0
        period_totals: dict[str, dict[str, Any]] = {}
        embeddings: list[dict[str, Any]] = []

        for bucket in buckets:
            for label, count in bucket["distribution"].items():
                distribution[label] += count
            total_score += bucket["score_sum"]
            total_messages += bucket["message_count"]
            embeddings.extend(bucket.get("embeddings", []))

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
            "embeddings": embeddings,
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

    def _build_sentiment_analyzer(self, backend: str):
        backend = backend.lower()
        neural_aliases = {"distilbert", "tinybert", "onnx", "bert"}
        if backend in neural_aliases:
            if backend == "tinybert":
                logger.info(
                    "The TinyBERT backend has been replaced by DistilBERT but remains as an alias."
                )
            try:
                return DistilBertOnnxSentimentAnalyzer()
            except Exception as exc:
                logger.warning(
                    "DistilBERT sentiment backend unavailable (%s); falling back to lexicon-based analyzer",
                    exc,
                )
        self._sentiment_backend = "lexical"
        return LexicalSentimentAnalyzer()

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
            reference_time=data.export_date,
            include_group_chats=self._include_group_chats_in_ghosts,
        )

        contact_names = {
            conv.chat_identifier: conv.display_name or conv.chat_identifier
            for conv in conversations.values()
        }

        def _serialize(entries: dict[str, datetime]) -> list[dict[str, Any]]:
            return [
                {
                    "contact_id": contact_id,
                    "contact_name": contact_names.get(contact_id) or contact_id,
                    "last_message": timestamp.isoformat(),
                }
                for contact_id, timestamp in sorted(entries.items(), key=lambda item: item[1], reverse=True)
            ]

        you_ghosted = _serialize(stats.you_ghosted)
        ghosted_you = _serialize(stats.ghosted_you)
        ratio = None
        if stats.ghostees:
            ratio = round(stats.ghosts / stats.ghostees, 2)

        timeline_days = max(int(self._ghost_timeline.total_seconds() // 86400), 1)

        return {
            "timeline_days": timeline_days,
            "people_you_ghosted": stats.ghosts,
            "people_who_ghosted_you": stats.ghostees,
            "ghost_ratio": ratio,
            "you_ghosted": you_ghosted,
            "ghosted_you": ghosted_you,
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


class LLMStatisticsAnalyzer(StatisticsAnalyzer):
    @property
    def name(self) -> str:
        return "llm"

    def analyze(self, data: ExportData) -> dict[str, Any]:
        return {
            "status": "not_implemented",
            "message": "LLM analysis requires API configuration (OpenAI, Anthropic)",
            "planned_features": [
                "conversation_highlights",
                "relationship_insights",
                "thematic_analysis",
                "custom_narratives",
                "comparative_analysis",
            ],
        }

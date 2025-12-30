from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

from .models import Conversation, ExportData, Message
from .sentiment import LexicalSentimentAnalyzer


def _filter_year_messages(conv: Conversation, year: int) -> list[Message]:
    return [
        msg
        for msg in conv.messages
        if not getattr(msg, "is_context_only", False) and msg.timestamp.year == year
    ]


def compute_sentiment_for_export(data: ExportData, interval: str = "month") -> Dict[str, Any]:
    analyzer = LexicalSentimentAnalyzer()

    sent_messages: list[Message] = []
    received_messages: list[Message] = []
    for conv in data.conversations.values():
        for msg in _filter_year_messages(conv, data.year):
            if not (msg.text or "").strip():
                continue
            if msg.is_from_me:
                sent_messages.append(msg)
            else:
                received_messages.append(msg)

    def score_messages(messages: List[Message]) -> Dict[str, Any]:
        distribution = {"positive": 0, "neutral": 0, "negative": 0}
        total_score = 0.0
        total_messages = 0
        period_totals: dict[str, dict[str, Any]] = {}

        for msg in messages:
            text = (msg.text or "").strip()
            if not text:
                continue
            result = analyzer.analyze(text)
            distribution[result.label] += 1
            total_score += result.score
            total_messages += 1

            period_key = _period_key(msg.timestamp, interval)
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

        return {
            "distribution": distribution,
            "score_sum": total_score,
            "message_count": total_messages,
            "period_totals": period_totals,
        }

    sent_bucket = score_messages(sent_messages)
    received_bucket = score_messages(received_messages)
    overall_bucket = _combine_buckets(sent_bucket, received_bucket)

    if overall_bucket["message_count"] == 0:
        return {}

    sentiment = {
        "overall": _public_view(overall_bucket),
        "sent": _public_view(sent_bucket),
        "received": _public_view(received_bucket),
        "periods": {
            "interval": interval,
            "overall": _format_period_trend(overall_bucket["period_totals"], data.year, interval),
            "sent": _format_period_trend(sent_bucket["period_totals"], data.year, interval),
            "received": _format_period_trend(received_bucket["period_totals"], data.year, interval),
        },
    }
    return sentiment


def _public_view(bucket: dict[str, Any]) -> dict[str, Any]:
    avg_score = (
        round(bucket["score_sum"] / bucket["message_count"], 3) if bucket["message_count"] else 0.0
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
    period_totals: dict[str, dict[str, Any]], year: int, interval: str
) -> list[dict[str, Any]]:
    if interval != "month":
        # Keep the implementation scoped to month granularity for export.
        return []

    trend: list[dict[str, Any]] = []
    for month in range(1, 13):
        period = f"{year}-{month:02d}"
        values = period_totals.get(
            period,
            {
                "sum": 0.0,
                "count": 0,
                "distribution": {"positive": 0, "neutral": 0, "negative": 0},
            },
        )
        count = values["count"]
        if not count:
            trend.append(
                {
                    "period": period,
                    "avg_score": 0.0,
                    "message_count": 0,
                    "distribution": {"positive": 0, "neutral": 0, "negative": 0},
                }
            )
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


def _combine_buckets(*buckets: dict[str, Any]) -> dict[str, Any]:
    distribution = Counter({"positive": 0, "neutral": 0, "negative": 0})
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
        "distribution": dict(distribution),
        "score_sum": total_score,
        "message_count": total_messages,
        "period_totals": period_totals,
    }


def _period_key(timestamp, interval: str) -> str:
    if interval.lower() == "month":
        return timestamp.strftime("%Y-%m")
    raise ValueError(f"Unsupported sentiment interval: {interval}")

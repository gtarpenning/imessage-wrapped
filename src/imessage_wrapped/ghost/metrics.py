from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

from ..models import Conversation, Message


@dataclass
class GhostStats:
    timeline: timedelta
    reference_time: datetime
    min_consecutive_messages: int
    min_conversation_messages: int
    you_ghosted_count: int = 0
    ghosted_you_count: int = 0


def compute_ghost_stats(
    conversations: Iterable[Conversation],
    *,
    year: int,
    timeline: timedelta,
    min_consecutive_messages: int,
    min_conversation_messages: int,
    reference_time: datetime | None = None,
    include_group_chats: bool = False,
) -> GhostStats:
    """
    Classify which contacts were ghosted in each direction.

    Args:
        conversations: Conversations to evaluate (already filtered upstream).
        year: The export year to respect when reading messages.
        timeline: Maximum allowed silence between replies.
        min_consecutive_messages: Minimum run length before silence counts.
        min_conversation_messages: Minimum sent+received messages for analysis.
        reference_time: Used when no further responses exist.
        include_group_chats: Whether to include group conversations.
    """

    if timeline <= timedelta(0):
        raise ValueError("timeline must be a positive duration")

    if min_consecutive_messages <= 0:
        raise ValueError("min_consecutive_messages must be positive")

    reference_time = _normalize_reference_time(reference_time)
    stats = GhostStats(
        timeline=timeline,
        reference_time=reference_time,
        min_consecutive_messages=min_consecutive_messages,
        min_conversation_messages=min_conversation_messages,
    )

    for conversation in conversations:
        if conversation.is_group_chat and not include_group_chats:
            continue

        messages = _conversation_messages(conversation, year)
        if len(messages) < min_conversation_messages:
            continue

        you_ghosted, they_ghosted = _classify_conversation(
            messages,
            timeline,
            reference_time,
            min_consecutive_messages=min_consecutive_messages,
        )

        if you_ghosted:
            stats.you_ghosted_count += 1
        if they_ghosted:
            stats.ghosted_you_count += 1

    return stats


def _normalize_reference_time(ts: datetime | None) -> datetime:
    if ts is None:
        return datetime.now(timezone.utc)
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def _conversation_messages(conversation: Conversation, year: int) -> list[Message]:
    messages = [
        msg
        for msg in conversation.messages
        if not getattr(msg, "is_context_only", False) and msg.timestamp.year == year
    ]
    messages.sort(key=lambda m: m.timestamp)
    return messages


def _classify_conversation(
    messages: list[Message],
    timeline: timedelta,
    reference_time: datetime,
    *,
    min_consecutive_messages: int,
) -> tuple[bool, bool]:
    """
    Determine whether each direction satisfies the ghost criteria.
    """

    runs = _generate_runs(messages)
    you_ghosted = False
    ghosted_you = False

    for run in runs:
        if run.length < min_consecutive_messages:
            continue

        response_time = _next_response_time(messages, run.end_index, reference_time)
        if response_time is None:
            continue

        silence = response_time - run.end_timestamp
        if silence < timeline:
            continue

        if run.actor == "me":
            ghosted_you = True
        else:
            you_ghosted = True

        if you_ghosted and ghosted_you:
            break

    return you_ghosted, ghosted_you


@dataclass
class _Run:
    actor: str  # "me" or "them"
    length: int
    end_index: int
    end_timestamp: datetime


def _generate_runs(messages: list[Message]) -> list[_Run]:
    runs: list[_Run] = []
    current_actor: str | None = None
    run_length = 0
    for idx, message in enumerate(messages):
        actor = "me" if message.is_from_me else "them"
        if actor != current_actor:
            if current_actor is not None:
                runs.append(
                    _Run(
                        actor=current_actor,
                        length=run_length,
                        end_index=idx - 1,
                        end_timestamp=messages[idx - 1].timestamp,
                    )
                )
            current_actor = actor
            run_length = 1
        else:
            run_length += 1

    if current_actor is not None and run_length > 0:
        runs.append(
            _Run(
                actor=current_actor,
                length=run_length,
                end_index=len(messages) - 1,
                end_timestamp=messages[-1].timestamp,
            )
        )

    return runs


def _next_response_time(
    messages: list[Message],
    run_end_index: int,
    reference_time: datetime,
) -> datetime | None:
    if run_end_index == len(messages) - 1:
        return reference_time
    return messages[run_end_index + 1].timestamp

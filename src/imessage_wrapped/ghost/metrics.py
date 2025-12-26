from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable

from ..models import Conversation, Message


@dataclass
class GhostStats:
    """
    Container for the "ghost" style statistics.

    Attributes:
        timeline: The time span used to classify ghost events.
        reference_time: The timestamp used when no further responses exist.
        you_ghosted: Mapping of contact identifier → timestamp of the inbound
            message you never responded to in time.
        ghosted_you: Mapping of contact identifier → timestamp of the outbound
            message that never received a timely response.
    """

    timeline: timedelta
    reference_time: datetime
    you_ghosted: dict[str, datetime] = field(default_factory=dict)
    ghosted_you: dict[str, datetime] = field(default_factory=dict)

    @property
    def ghosts(self) -> int:
        """Number of people you left hanging."""

        return len(self.you_ghosted)

    @property
    def ghostees(self) -> int:
        """Number of people who never responded to you."""

        return len(self.ghosted_you)


def compute_ghost_stats(
    conversations: Iterable[Conversation],
    *,
    year: int,
    timeline: timedelta,
    reference_time: datetime | None = None,
    include_group_chats: bool = False,
) -> GhostStats:
    """
    Classify which contacts were ghosted in each direction.

    Args:
        conversations: Conversations to evaluate (already filtered upstream).
        year: The export year to respect when reading messages.
        timeline: Maximum allowed silence between replies.
        reference_time: Used to determine if the outstanding silence has
            already exceeded the threshold. Defaults to now() UTC.
        include_group_chats: Whether to include group conversations.
    """

    if timeline <= timedelta(0):
        raise ValueError("timeline must be a positive duration")

    reference_time = _normalize_reference_time(reference_time)
    stats = GhostStats(timeline=timeline, reference_time=reference_time)

    for conversation in conversations:
        if conversation.is_group_chat and not include_group_chats:
            continue

        messages = _conversation_messages(conversation, year)
        if not messages:
            continue

        you_ghosted, they_ghosted = _classify_conversation(messages, timeline, reference_time)

        if you_ghosted:
            stats.you_ghosted.setdefault(conversation.chat_identifier, you_ghosted)
        if they_ghosted:
            stats.ghosted_you.setdefault(conversation.chat_identifier, they_ghosted)

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
) -> tuple[datetime | None, datetime | None]:
    """
    Return timestamps for the offending ghost events if they exist.

    The first element represents the inbound message you ignored. The second
    element represents the outbound message that never received a reply.
    """

    you_left_hanging: datetime | None = None
    they_left_you_hanging: datetime | None = None

    next_message_from_you: datetime | None = None
    next_message_from_them: datetime | None = None

    for message in reversed(messages):
        if message.is_from_me:
            you_left_hanging = you_left_hanging or _classify_gap(
                candidate_time=message.timestamp,
                next_response=next_message_from_them,
                fallback=reference_time,
                timeline=timeline,
            )
            next_message_from_you = message.timestamp
        else:
            they_left_you_hanging = they_left_you_hanging or _classify_gap(
                candidate_time=message.timestamp,
                next_response=next_message_from_you,
                fallback=reference_time,
                timeline=timeline,
            )
            next_message_from_them = message.timestamp

        if you_left_hanging and they_left_you_hanging:
            break

    return you_left_hanging, they_left_you_hanging


def _classify_gap(
    *,
    candidate_time: datetime,
    next_response: datetime | None,
    fallback: datetime,
    timeline: timedelta,
) -> datetime | None:
    """
    Decide whether the silence window for the candidate exceeds the threshold.

    Args:
        candidate_time: Timestamp of the message being evaluated.
        next_response: Timestamp of the next message from the *other* party.
        fallback: Timestamp to use if no future response exists.
        timeline: Maximum acceptable silent period.
    """

    response_time = next_response or fallback
    if response_time - candidate_time > timeline:
        return candidate_time
    return None

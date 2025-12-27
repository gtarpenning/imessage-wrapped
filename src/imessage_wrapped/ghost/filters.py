from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Protocol, Sequence

from ..models import Conversation, Message


class ConversationFilter(Protocol):
    """Callable object that decides if a conversation should be used."""

    @property
    def name(self) -> str:  # pragma: no cover - trivial
        ...

    def __call__(self, conversation: Conversation, *, year: int) -> bool: ...


def apply_conversation_filters(
    conversations: Mapping[str, Conversation],
    *,
    year: int,
    filters: Sequence[ConversationFilter] | None = None,
) -> dict[str, Conversation]:
    """
    Return a shallow copy of the conversations mapping with only the items that pass
    every provided filter. Filters can be omitted to keep all conversations.
    """

    if not filters:
        return dict(conversations)

    filtered: dict[str, Conversation] = {}
    for key, conversation in conversations.items():
        if all(filter_fn(conversation, year=year) for filter_fn in filters):
            filtered[key] = conversation
    return filtered


def _messages_in_year(conversation: Conversation, year: int) -> Iterable[Message]:
    for message in conversation.messages:
        if getattr(message, "is_context_only", False):
            continue
        if message.timestamp.year != year:
            continue
        yield message


@dataclass
class _BaseFilter:
    min_messages_required: int = 1

    def _count_messages(self, conversation: Conversation, year: int) -> tuple[int, int]:
        sent = 0
        received = 0
        for msg in _messages_in_year(conversation, year):
            if msg.is_from_me:
                sent += 1
            else:
                received += 1
        return sent, received

    def _total_messages(self, conversation: Conversation, year: int) -> int:
        return sum(1 for _ in _messages_in_year(conversation, year))


@dataclass
class _ReceivedToSentRatioFilter(_BaseFilter):
    max_ratio: float = 9.0

    @property
    def name(self) -> str:
        return "received_to_sent_ratio"

    def __call__(self, conversation: Conversation, *, year: int) -> bool:
        sent, received = self._count_messages(conversation, year)

        if sent < self.min_messages_required:
            return False

        if received == 0:
            return True

        ratio = received / max(sent, 1)
        return ratio <= self.max_ratio


@dataclass
class _MinimumResponsesFilter(_BaseFilter):
    min_user_responses: int = 2

    @property
    def name(self) -> str:
        return "minimum_user_responses"

    def __call__(self, conversation: Conversation, *, year: int) -> bool:
        sent, _ = self._count_messages(conversation, year)
        return sent >= self.min_user_responses


@dataclass
class _MinimumTotalMessagesFilter(_BaseFilter):
    min_total_messages: int = 10

    @property
    def name(self) -> str:
        return "minimum_total_messages"

    def __call__(self, conversation: Conversation, *, year: int) -> bool:
        return self._total_messages(conversation, year) >= self.min_total_messages


def received_to_sent_ratio_filter(
    *,
    max_ratio: float = 9.0,
    min_messages_required: int = 1,
) -> ConversationFilter:
    """Factory for the ratio filter to keep instantiation call sites tidy."""

    return _ReceivedToSentRatioFilter(
        max_ratio=max_ratio,
        min_messages_required=min_messages_required,
    )


def minimum_responses_filter(
    *,
    min_user_responses: int = 2,
) -> ConversationFilter:
    """Factory for filtering out conversations with too few outbound replies."""

    return _MinimumResponsesFilter(
        min_user_responses=min_user_responses,
        min_messages_required=min_user_responses,
    )


def minimum_total_messages_filter(
    *,
    min_total_messages: int = 10,
) -> ConversationFilter:
    """Filter out lightweight chats with too little context."""

    return _MinimumTotalMessagesFilter(
        min_total_messages=min_total_messages,
        min_messages_required=min_total_messages,
    )

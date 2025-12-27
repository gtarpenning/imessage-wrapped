from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Tapback:
    type: str
    by: str


@dataclass
class Message:
    id: int
    guid: str
    timestamp: datetime
    is_from_me: bool
    sender: str
    text: str | None
    service: str
    has_attachment: bool
    date_read_after_seconds: float | None = None
    tapbacks: list[Tapback] = field(default_factory=list)
    is_context_only: bool = False

    @property
    def timestamp_iso(self) -> str:
        return self.timestamp.isoformat()

    @property
    def timestamp_unix(self) -> int:
        return int(self.timestamp.timestamp())


@dataclass
class Conversation:
    chat_id: int
    chat_identifier: str
    display_name: str | None
    is_group_chat: bool
    participants: list[str]
    messages: list[Message] = field(default_factory=list)

    @property
    def message_count(self) -> int:
        return len([msg for msg in self.messages if not getattr(msg, "is_context_only", False)])


@dataclass
class ExportData:
    export_date: datetime
    year: int
    conversations: dict[str, Conversation]

    @property
    def total_messages(self) -> int:
        return sum(conv.message_count for conv in self.conversations.values())

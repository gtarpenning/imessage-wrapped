import json
from pathlib import Path
from typing import Protocol

from .models import Conversation, ExportData, Message, Tapback


class Serializer(Protocol):
    def serialize(self, data: ExportData) -> str: ...


class JSONSerializer:
    def __init__(self, indent: int | None = 2):
        self.indent = indent

    def serialize(self, data: ExportData) -> str:
        payload = {
            "export_date": data.export_date.isoformat(),
            "year": data.year,
            "total_messages": data.total_messages,
            "conversations": {
                key: self._serialize_conversation(conv) for key, conv in data.conversations.items()
            },
        }
        return json.dumps(payload, indent=self.indent, ensure_ascii=False)

    def _serialize_conversation(self, conv: Conversation) -> dict:
        return {
            "chat_identifier": conv.chat_identifier,
            "display_name": conv.display_name,
            "is_group_chat": conv.is_group_chat,
            "participants": conv.participants,
            "messages": [self._serialize_message(msg) for msg in conv.messages],
        }

    def _serialize_message(self, msg: Message) -> dict:
        data = {
            "id": msg.id,
            "guid": msg.guid,
            "timestamp": msg.timestamp_iso,
            "timestamp_unix": msg.timestamp_unix,
            "is_from_me": msg.is_from_me,
            "sender": msg.sender,
            "text": msg.text,
            "service": msg.service,
            "has_attachment": msg.has_attachment,
        }

        if msg.date_read_after_seconds is not None:
            data["date_read_after_seconds"] = msg.date_read_after_seconds

        if msg.tapbacks:
            data["tapbacks"] = [self._serialize_tapback(tb) for tb in msg.tapbacks]

        return data

    def _serialize_tapback(self, tapback: Tapback) -> dict:
        return {"type": tapback.type, "by": tapback.by}


class JSONLSerializer:
    def serialize(self, data: ExportData) -> str:
        lines = []
        for conv_key, conv in data.conversations.items():
            for msg in conv.messages:
                line_data = {
                    "export_date": data.export_date.isoformat(),
                    "year": data.year,
                    "conversation_key": conv_key,
                    "chat_identifier": conv.chat_identifier,
                    "display_name": conv.display_name,
                    "is_group_chat": conv.is_group_chat,
                    "participants": conv.participants,
                    "message": self._serialize_message(msg),
                }
                lines.append(json.dumps(line_data, ensure_ascii=False))
        return "\n".join(lines)

    def _serialize_message(self, msg: Message) -> dict:
        data = {
            "id": msg.id,
            "guid": msg.guid,
            "timestamp": msg.timestamp_iso,
            "timestamp_unix": msg.timestamp_unix,
            "is_from_me": msg.is_from_me,
            "sender": msg.sender,
            "text": msg.text,
            "service": msg.service,
            "has_attachment": msg.has_attachment,
        }

        if msg.date_read_after_seconds is not None:
            data["date_read_after_seconds"] = msg.date_read_after_seconds

        if msg.tapbacks:
            data["tapbacks"] = [self._serialize_tapback(tb) for tb in msg.tapbacks]

        return data

    def _serialize_tapback(self, tapback: Tapback) -> dict:
        return {"type": tapback.type, "by": tapback.by}


class Exporter:
    def __init__(self, serializer: Serializer | None = None):
        self.serializer = serializer or JSONLSerializer()

    def export_to_string(self, data: ExportData) -> str:
        return self.serializer.serialize(data)

    def export_to_file(self, data: ExportData, output_path: str | Path) -> None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        content = self.export_to_string(data)
        output_path.write_text(content, encoding="utf-8")

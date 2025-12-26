import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .models import Conversation, ExportData, Message, Tapback


class ExportLoader:
    @staticmethod
    def load_from_jsonl(file_path: str | Path) -> ExportData:
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"Export file not found: {file_path}")

        conversations_dict = defaultdict(
            lambda: {
                "messages": [],
                "chat_identifier": None,
                "display_name": None,
                "is_group_chat": False,
                "participants": [],
            }
        )

        export_date = None
        year = None

        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON on line {line_num}: {e}")

                if export_date is None:
                    export_date = datetime.fromisoformat(data["export_date"])
                if year is None:
                    year = data["year"]

                conv_key = data["conversation_key"]
                conv_data = conversations_dict[conv_key]

                conv_data["chat_identifier"] = data["chat_identifier"]
                conv_data["display_name"] = data.get("display_name")
                conv_data["is_group_chat"] = data.get("is_group_chat", False)
                conv_data["participants"] = data.get("participants", [])

                msg_data = data["message"]
                message = Message(
                    id=msg_data["id"],
                    guid=msg_data["guid"],
                    timestamp=datetime.fromisoformat(msg_data["timestamp"]),
                    is_from_me=msg_data["is_from_me"],
                    sender=msg_data["sender"],
                    text=msg_data.get("text"),
                    service=msg_data["service"],
                    has_attachment=msg_data["has_attachment"],
                    date_read_after_seconds=msg_data.get("date_read_after_seconds"),
                    tapbacks=[
                        Tapback(type=tb["type"], by=tb["by"]) for tb in msg_data.get("tapbacks", [])
                    ],
                )

                conv_data["messages"].append(message)

        if export_date is None or year is None:
            raise ValueError("Export file is empty or missing required fields")

        conversations = {}
        for conv_key, conv_data in conversations_dict.items():
            conversation = Conversation(
                chat_id=0,
                chat_identifier=conv_data["chat_identifier"],
                display_name=conv_data["display_name"],
                is_group_chat=conv_data["is_group_chat"],
                participants=conv_data["participants"],
                messages=conv_data["messages"],
            )
            conversations[conv_key] = conversation

        return ExportData(
            export_date=export_date,
            year=year,
            conversations=conversations,
        )

    @staticmethod
    def load_from_json(file_path: str | Path) -> ExportData:
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"Export file not found: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        export_date = datetime.fromisoformat(data["export_date"])
        year = data["year"]

        conversations = {}
        for conv_key, conv_data in data["conversations"].items():
            messages = []
            for msg_data in conv_data["messages"]:
                message = Message(
                    id=msg_data["id"],
                    guid=msg_data["guid"],
                    timestamp=datetime.fromisoformat(msg_data["timestamp"]),
                    is_from_me=msg_data["is_from_me"],
                    sender=msg_data["sender"],
                    text=msg_data.get("text"),
                    service=msg_data["service"],
                    has_attachment=msg_data["has_attachment"],
                    date_read_after_seconds=msg_data.get("date_read_after_seconds"),
                    tapbacks=[
                        Tapback(type=tb["type"], by=tb["by"]) for tb in msg_data.get("tapbacks", [])
                    ],
                )
                messages.append(message)

            conversation = Conversation(
                chat_id=0,
                chat_identifier=conv_data["chat_identifier"],
                display_name=conv_data.get("display_name"),
                is_group_chat=conv_data["is_group_chat"],
                participants=conv_data["participants"],
                messages=messages,
            )
            conversations[conv_key] = conversation

        return ExportData(
            export_date=export_date,
            year=year,
            conversations=conversations,
        )

    @staticmethod
    def load(file_path: str | Path) -> ExportData:
        file_path = Path(file_path)

        if file_path.suffix == ".jsonl":
            return ExportLoader.load_from_jsonl(file_path)
        elif file_path.suffix == ".json":
            return ExportLoader.load_from_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}. Use .json or .jsonl")

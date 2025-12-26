from datetime import datetime, timezone

from imessage_wrapped.analyzer import RawStatisticsAnalyzer
from imessage_wrapped.models import Conversation, ExportData, Message
from imessage_wrapped.phrases import PhraseExtractionConfig


def build_message(message_id: int, text: str) -> Message:
    return Message(
        id=message_id,
        guid=f"msg-{message_id}",
        timestamp=datetime(2025, 1, 1, 12, 0, message_id, tzinfo=timezone.utc),
        is_from_me=True,
        sender="me",
        text=text,
        service="iMessage",
        has_attachment=False,
    )


def test_raw_analyzer_includes_phrase_stats():
    messages = [
        build_message(1, "On my way home now"),
        build_message(2, "Really on my way again"),
    ]

    conv = Conversation(
        chat_id=1,
        chat_identifier="contact_1",
        display_name="Alice",
        is_group_chat=False,
        participants=["me", "alice"],
        messages=messages,
    )

    export = ExportData(
        export_date=datetime(2025, 1, 1),
        year=2025,
        conversations={conv.chat_identifier: conv},
    )

    analyzer = RawStatisticsAnalyzer(
        sentiment_backend="lexical",
        phrase_config=PhraseExtractionConfig(
            min_text_messages=2,
            per_contact_min_text_messages=1,
            min_occurrences=2,
            min_characters=2,
            max_phrases=3,
            ngram_range=(3, 3),
        ),
    )

    stats = analyzer.analyze(export)
    content = stats["content"]

    assert "phrases" in content
    phrases = content["phrases"]
    assert phrases["overall"]
    assert phrases["overall"][0]["text"] == "on my way"
    assert phrases["overall"][0]["occurrences"] == 2
    by_contact = content.get("_phrases_by_contact")
    assert by_contact
    assert by_contact[0]["contact_name"] == "Alice"

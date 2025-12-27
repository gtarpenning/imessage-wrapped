from datetime import datetime, timedelta, timezone

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
    assert phrases["overall"][0]["phrase"] == "on my way"
    assert phrases["overall"][0]["occurrences"] == 2
    by_contact = content.get("_phrases_by_contact")
    assert by_contact
    assert by_contact[0]["contact_name"] == "Alice"


def build_conversation(contact_id: str, sent: int, received: int) -> Conversation:
    messages: list[Message] = []
    base_time = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc)
    counter = 0

    for _ in range(sent):
        counter += 1
        messages.append(
            Message(
                id=counter,
                guid=f"{contact_id}-sent-{counter}",
                timestamp=base_time,
                is_from_me=True,
                sender="me",
                text=f"sent {counter}",
                service="iMessage",
                has_attachment=False,
            )
        )
        base_time = base_time + timedelta(seconds=1)

    for _ in range(received):
        counter += 1
        messages.append(
            Message(
                id=counter,
                guid=f"{contact_id}-recv-{counter}",
                timestamp=base_time,
                is_from_me=False,
                sender=contact_id,
                text=f"recv {counter}",
                service="iMessage",
                has_attachment=False,
            )
        )
        base_time = base_time + timedelta(seconds=1)

    return Conversation(
        chat_id=counter,
        chat_identifier=contact_id,
        display_name=f"Contact {contact_id}",
        is_group_chat=False,
        participants=["me", contact_id],
        messages=messages,
    )


def test_chat_concentration_distribution():
    conv_a = build_conversation("a", sent=4, received=2)
    conv_b = build_conversation("b", sent=2, received=1)
    conv_c = build_conversation("c", sent=1, received=0)

    export = ExportData(
        export_date=datetime(2025, 1, 1),
        year=2025,
        conversations={
            conv_a.chat_identifier: conv_a,
            conv_b.chat_identifier: conv_b,
            conv_c.chat_identifier: conv_c,
        },
    )

    analyzer = RawStatisticsAnalyzer(
        phrase_config=PhraseExtractionConfig(
            min_text_messages=1,
            min_occurrences=1,
            min_characters=2,
            max_phrases=1,
            ngram_range=(2, 2),
        ),
        conversation_filters=(),
    )

    stats = analyzer.analyze(export)
    distribution = stats["contacts"]["message_distribution"]

    assert len(distribution) == 3
    assert distribution[0]["contact_id"] == "a"
    assert distribution[0]["share"] == round(6 / 10, 4)
    assert distribution[0]["count"] == 6
    assert distribution[1]["contact_id"] == "b"
    assert distribution[2]["contact_id"] == "c"

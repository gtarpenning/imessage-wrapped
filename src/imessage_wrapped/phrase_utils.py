from typing import Any, Tuple

from .models import Conversation, ExportData, Message
from .phrases import PhraseExtractionConfig, PhraseExtractor


def _filter_year_messages(conversation: Conversation, year: int) -> list[Message]:
    return [
        msg
        for msg in conversation.messages
        if not getattr(msg, "is_context_only", False) and msg.timestamp.year == year
    ]


def compute_phrases_for_export(
    data: ExportData, phrase_config: PhraseExtractionConfig | None = None
) -> Tuple[dict[str, Any], list[dict[str, Any]]]:
    extractor = PhraseExtractor(config=phrase_config)

    texts = []
    per_contact_messages: dict[str, list[str]] = {}
    contact_names: dict[str, str] = {}

    for conv in data.conversations.values():
        contact_id = conv.chat_identifier
        contact_names[contact_id] = conv.display_name or contact_id
        conv_texts = []
        for msg in _filter_year_messages(conv, data.year):
            text = (msg.text or "").strip()
            if not text or not msg.is_from_me:
                continue
            texts.append(text)
            conv_texts.append(text)
        if conv_texts:
            per_contact_messages[contact_id] = conv_texts

    if not texts:
        return {}, []

    result = extractor.extract(
        texts,
        per_contact_messages=per_contact_messages or None,
        contact_names=contact_names or None,
    )

    if not result.overall:
        return {}, []

    def serialize_phrase(stat) -> dict[str, Any]:
        value = stat.text
        return {
            "phrase": value,
            "text": value,
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

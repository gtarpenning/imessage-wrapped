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
    for conv in data.conversations.values():
        conv_texts = []
        for msg in _filter_year_messages(conv, data.year):
            text = (msg.text or "").strip()
            if not text or not msg.is_from_me:
                continue
            texts.append(text)
            conv_texts.append(text)

    if not texts:
        return {}, []

    result = extractor.extract(
        texts,
        per_contact_messages=None,
        contact_names=None,
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

    overall = [serialize_phrase(stat) for stat in result.overall][:10]

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

    return public_payload, []

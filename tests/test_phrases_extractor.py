from imessage_wrapped.phrases import (
    PhraseExtractionConfig,
    PhraseExtractor,
)


def test_extracts_dominant_phrase_with_overlap_dedupe():
    config = PhraseExtractionConfig(
        min_text_messages=3,
        per_contact_min_text_messages=2,
        min_occurrences=2,
        max_phrases=3,
        ngram_range=(3, 3),  # focus on phrases instead of single tokens
    )
    extractor = PhraseExtractor(config=config)
    messages = [
        "On my way home now",
        "Totally on my way, promise",
        "Really on my way!!!",
        "See you soon",
    ]

    result = extractor.extract(messages)

    assert result.analyzed_messages == 4
    assert result.overall
    top_phrase = result.overall[0]
    assert top_phrase.text == "on my way"
    assert top_phrase.occurrences == 3
    # Share is relative to total counted phrases (only trigram counted)
    assert top_phrase.share == 1.0


def test_per_contact_breakdown_respects_minimums():
    config = PhraseExtractionConfig(
        min_text_messages=3,
        per_contact_min_text_messages=2,
        per_contact_limit=2,
        min_occurrences=1,
        max_phrases=5,
        min_characters=3,
    )
    extractor = PhraseExtractor(config=config)

    messages = [
        "k thanks bye",
        "see you later",
        "k thanks again",
    ]

    per_contact = {
        "alice": [
            "movie night tonight",
            "movie night again",
        ],
        "bob": [
            "gym time soon",
        ],  # below per-contact threshold -> should yield zero phrases
    }

    result = extractor.extract(messages, per_contact_messages=per_contact, contact_names={"alice": "Alice"})

    assert len(result.by_contact) == 2
    alice_stats = next(item for item in result.by_contact if item.contact_id == "alice")
    assert alice_stats.contact_name == "Alice"
    assert alice_stats.top_phrases
    assert "movie night" in alice_stats.top_phrases[0].text
    bob_stats = next(item for item in result.by_contact if item.contact_id == "bob")
    assert bob_stats.top_phrases == []


def test_tfidf_scoring_prioritizes_unique_phrase():
    config = PhraseExtractionConfig(
        min_text_messages=3,
        per_contact_min_text_messages=1,
        min_occurrences=2,
        min_characters=3,
        max_phrases=2,
        scoring="tfidf",
        ngram_range=(2, 2),
    )
    extractor = PhraseExtractor(config=config)

    messages = [
        "pumpkin spice latte season is back",
        "pumpkin spice latte launch tomorrow",
        "iced coffee iced coffee forever",
    ]

    result = extractor.extract(messages)
    assert result.overall
    assert result.overall[0].text == "iced coffee"

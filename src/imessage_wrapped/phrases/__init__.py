"""
Phrase analysis utilities for surfacing most-used expressions.

This package intentionally mirrors the sentiment module layout: the public API
exposes lightweight dataclasses and a single `PhraseExtractor` facade while the
implementation details (tokenization heuristics, TF-IDF scoring, stopwords,
etc.) live in dedicated submodules.  That makes it easy to plug the extractor
into the analyzer/CLI later without dragging extra dependencies into callers.
"""

from .extractor import (
    ContactPhraseStats,
    PhraseExtractionConfig,
    PhraseExtractionResult,
    PhraseExtractor,
    PhraseStat,
)

__all__ = [
    "PhraseExtractionConfig",
    "PhraseExtractionResult",
    "PhraseExtractor",
    "PhraseStat",
    "ContactPhraseStats",
]

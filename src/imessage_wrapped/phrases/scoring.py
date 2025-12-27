"""
Helpers for assigning scores to extracted phrases.

We keep the logic small and dependency-free so the feature can run in the
desktop/CLI environments without pulling in scikit-learn.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Mapping

__all__ = ["ScoredPhrase", "TfIdfScorer", "FrequencyScorer"]


@dataclass(frozen=True)
class ScoredPhrase:
    text: str
    occurrences: int
    score: float


class FrequencyScorer:
    """Default scorer: the score is simply the frequency count as a float."""

    def score(
        self,
        phrase_counts: Mapping[str, int],
        doc_frequencies: Mapping[str, int],
        total_documents: int,
    ) -> list[ScoredPhrase]:
        return [
            ScoredPhrase(text=phrase, occurrences=count, score=float(count))
            for phrase, count in phrase_counts.items()
        ]


class TfIdfScorer:
    """Tiny TF-IDF implementation tailored for already-counted phrases."""

    def __init__(self, smooth: bool = True):
        self._smooth = smooth

    def score(
        self,
        phrase_counts: Mapping[str, int],
        doc_frequencies: Mapping[str, int],
        total_documents: int,
    ) -> list[ScoredPhrase]:
        if total_documents <= 0:
            return []

        scores: list[ScoredPhrase] = []
        for phrase, count in phrase_counts.items():
            doc_freq = max(1, doc_frequencies.get(phrase, 0))
            idf = self._idf(total_documents, doc_freq)
            scores.append(
                ScoredPhrase(
                    text=phrase,
                    occurrences=count,
                    score=count * idf,
                )
            )
        return scores

    def _idf(self, total_docs: int, doc_freq: int) -> float:
        if self._smooth:
            # Smooth by adding 1 to numerator/denominator to avoid division by zero
            return math.log((1 + total_docs) / (1 + doc_freq)) + 1.0
        return math.log(total_docs / doc_freq)

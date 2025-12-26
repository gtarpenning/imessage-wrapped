from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Mapping

from .lexicon import BOOSTER_WORDS, LEXICON, NEGATIONS

__all__ = ["SentimentResult", "LexicalSentimentAnalyzer"]


@dataclass(frozen=True)
class SentimentResult:
    score: float  # normalized to [-1, 1]
    label: str  # "positive", "neutral", or "negative"


class LexicalSentimentAnalyzer:
    """Simple rule-based sentiment scorer with a tiny footprint."""

    WORD_PATTERN = re.compile(r"[A-Za-z0-9']+")
    SENTIMENT_THRESHOLD = 0.12
    NORMALIZER = 3.5
    MAX_EXCLAMATION_EMPHASIS = 4
    NEGATION_WINDOW = 2

    def __init__(self, lexicon: Mapping[str, float] | None = None):
        self._lexicon = {k: float(v) for k, v in (lexicon or LEXICON).items()}

    def analyze(self, text: str | None) -> SentimentResult:
        if not text:
            return SentimentResult(0.0, "neutral")

        tokens = self.WORD_PATTERN.findall(text)
        if not tokens:
            return SentimentResult(0.0, "neutral")

        total_score = 0.0
        hit_count = 0
        negate_window = 0
        previous_token: str | None = None

        for token in tokens:
            token_lower = token.lower()
            if token_lower in NEGATIONS:
                negate_window = self.NEGATION_WINDOW
                previous_token = token_lower
                continue

            lex_score = self._lexicon.get(token_lower)
            modifier = 1.0

            if previous_token and previous_token in BOOSTER_WORDS:
                modifier += BOOSTER_WORDS[previous_token]

            if lex_score is None:
                previous_token = token_lower
                if negate_window:
                    negate_window -= 1
                continue

            if negate_window:
                modifier *= -0.75
                negate_window -= 1

            if token.isupper() and len(token) > 1:
                modifier += 0.15

            total_score += lex_score * modifier
            hit_count += 1
            previous_token = token_lower

        if hit_count == 0:
            return SentimentResult(0.0, "neutral")

        normalized = total_score / (hit_count * self.NORMALIZER)
        normalized = max(min(normalized, 1.0), -1.0)

        exclamations = min(text.count("!"), self.MAX_EXCLAMATION_EMPHASIS)
        if exclamations and normalized != 0:
            normalized += math.copysign(exclamations * 0.02, normalized)

        normalized = max(min(normalized, 1.0), -1.0)
        label = self._label_from_score(normalized)
        return SentimentResult(round(normalized, 3), label)

    def _label_from_score(self, score: float) -> str:
        if score >= self.SENTIMENT_THRESHOLD:
            return "positive"
        if score <= -self.SENTIMENT_THRESHOLD:
            return "negative"
        return "neutral"

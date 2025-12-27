from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Mapping, Sequence

from .lexicon import BOOSTER_WORDS, LEXICON, NEGATIONS

__all__ = ["SentimentResult", "LexicalSentimentAnalyzer"]


EMOJI_SENTIMENT = {
    "❤️": 2.5,
    "💖": 2.2,
    "😍": 2.2,
    "🥰": 2.0,
    "😘": 1.8,
    "😊": 1.5,
    "🙂": 1.0,
    "🤗": 1.5,
    "🔥": 1.2,
    "👍": 1.0,
    "👏": 1.2,
    "😂": 1.1,
    "🤣": 1.1,
    "😁": 1.0,
    "😎": 0.9,
    "🙌": 1.0,
    "💯": 1.4,
    "😢": -1.4,
    "😭": -2.2,
    "😞": -1.2,
    "😔": -1.0,
    "😠": -1.5,
    "😡": -1.8,
    "🤬": -2.0,
    "💔": -1.8,
    "👎": -1.2,
    "🙁": -0.9,
    "😱": -1.6,
    "🤢": -1.7,
    "🤮": -2.2,
    "🥴": -0.8,
    "😤": -1.1,
    "😩": -1.4,
}

EMOTICON_SENTIMENT = {
    ":)": 1.2,
    "(:": 1.2,
    ":D": 1.6,
    "xD": 1.4,
    "XD": 1.4,
    ";)": 0.8,
    "<3": 1.8,
    ":-)": 1.2,
    "=)": 1.0,
    ":(": -1.4,
    "):": -1.4,
    ":'(": -1.8,
    ":-(": -1.4,
    "=(": -1.4,
    ">:(": -1.8,
    ":-/": -0.8,
    ":-|": -0.4,
}

IDIOM_SENTIMENT: dict[Sequence[str], float] = {
    ("not", "bad"): 1.5,
    ("not", "good"): -1.4,
    ("kind", "of", "annoyed"): -1.2,
    ("kind", "of", "excited"): 1.2,
    ("sick", "of"): -1.6,
    ("sick", "in", "a", "good", "way"): 1.7,
    ("no", "way"): -1.1,
    ("love", "you"): 1.8,
    ("miss", "you"): -0.8,
    ("can't", "wait"): 1.6,
    ("so", "over", "it"): -1.5,
    ("lost", "for", "words"): -1.1,
    ("over", "the", "moon"): 1.9,
    ("happy", "for", "you"): 1.4,
}

CASUAL_INTENSIFIERS = {
    "super": 0.65,
    "mega": 0.7,
    "hella": 0.8,
    "crazy": 0.5,
    "mad": 0.45,
}


@dataclass(frozen=True)
class SentimentResult:
    score: float  # normalized to [-1, 1]
    label: str  # "positive", "neutral", or "negative"


class LexicalSentimentAnalyzer:
    """Simple rule-based sentiment scorer with a tiny footprint."""

    WORD_PATTERN = re.compile(r"[A-Za-z0-9#'@]+")
    SENTIMENT_THRESHOLD = 0.12
    NORMALIZER = 1.5
    MAX_EXCLAMATION_EMPHASIS = 4
    NEGATION_WINDOW = 2
    MAX_TOKEN_REDUCTION = 4
    VARIANCE_BASELINE = 0.15

    def __init__(self, lexicon: Mapping[str, float] | None = None):
        self._lexicon = {k: float(v) for k, v in (lexicon or LEXICON).items()}

    def analyze(self, text: str | None) -> SentimentResult:
        if not text:
            return SentimentResult(0.0, "neutral")

        tokens = [self._normalize_token(tok) for tok in self.WORD_PATTERN.findall(text)]
        tokens = [tok for tok in tokens if tok]
        if not tokens:
            return self._emoji_only_score(text)

        tokens, idiom_bonus = self._apply_idiom_scores(tokens)

        total_score = 0.0
        hit_count = 0
        negate_window = 0
        previous_token: str | None = None

        for token in tokens:
            if token in NEGATIONS:
                negate_window = self.NEGATION_WINDOW
                previous_token = token
                continue

            lex_score = self._lexicon.get(token)
            modifier = 1.0

            if previous_token and previous_token in BOOSTER_WORDS:
                modifier += BOOSTER_WORDS[previous_token]
            elif previous_token and previous_token in CASUAL_INTENSIFIERS:
                modifier += CASUAL_INTENSIFIERS[previous_token]

            if lex_score is None and token.startswith("#"):
                lex_score = self._lexicon.get(token[1:])

            if lex_score is None:
                previous_token = token
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
            previous_token = token

        if hit_count == 0:
            emoji_result = self._emoji_only_score(text)
            if emoji_result.label != "neutral":
                return emoji_result
            return SentimentResult(0.0, "neutral")

        total_score += idiom_bonus
        total_score += self._emoji_bonus(text)
        total_score += self._emoticon_bonus(text)

        normalized = total_score / (hit_count * self.NORMALIZER)
        normalized = max(min(normalized, 1.0), -1.0)

        exclamations = min(text.count("!"), self.MAX_EXCLAMATION_EMPHASIS)
        if exclamations and normalized != 0:
            normalized += math.copysign(exclamations * 0.02, normalized)

        if "??" in text:
            normalized -= 0.05

        normalized = max(min(normalized, 1.0), -1.0)
        normalized = self._boost_variance(normalized)
        label = self._label_from_score(normalized)
        return SentimentResult(round(normalized, 3), label)

    def _label_from_score(self, score: float) -> str:
        if score >= self.SENTIMENT_THRESHOLD:
            return "positive"
        if score <= -self.SENTIMENT_THRESHOLD:
            return "negative"
        return "neutral"

    def _normalize_token(self, token: str) -> str:
        lowered = token.lower()
        if lowered.startswith("@"):
            return ""
        if lowered.startswith("#") and len(lowered) > 1:
            lowered = "#" + lowered[1:]
        lowered = self._squash_repeated_chars(lowered)
        return lowered

    def _squash_repeated_chars(self, token: str) -> str:
        if len(token) <= 3:
            return token
        result = []
        last_char = ""
        repeat_count = 0
        for char in token:
            if char == last_char:
                repeat_count += 1
            else:
                repeat_count = 1
                last_char = char
            if repeat_count <= self.MAX_TOKEN_REDUCTION:
                result.append(char)
        return "".join(result)

    def _apply_idiom_scores(self, tokens: list[str]) -> tuple[list[str], float]:
        if not tokens:
            return tokens, 0.0

        adjustments = 0.0
        consumed: set[int] = set()
        for start in range(len(tokens)):
            if start in consumed:
                continue
            for phrase, score in IDIOM_SENTIMENT.items():
                length = len(phrase)
                if length == 0 or start + length > len(tokens):
                    continue
                if tokens[start : start + length] == list(phrase):
                    adjustments += score
                    for idx in range(start, start + length):
                        consumed.add(idx)
                    break

        filtered = [tok for idx, tok in enumerate(tokens) if idx not in consumed]
        return filtered, adjustments

    def _emoji_bonus(self, text: str) -> float:
        bonus = 0.0
        for char in text:
            if char in EMOJI_SENTIMENT:
                bonus += EMOJI_SENTIMENT[char]
        return bonus * 0.2

    def _emoticon_bonus(self, text: str) -> float:
        bonus = 0.0
        for emoticon, value in EMOTICON_SENTIMENT.items():
            if emoticon in text:
                bonus += value
        return bonus * 0.3

    def _emoji_only_score(self, text: str) -> SentimentResult:
        emoji_score = self._emoji_bonus(text) + self._emoticon_bonus(text)
        if emoji_score == 0:
            return SentimentResult(0.0, "neutral")
        normalized = max(min(emoji_score / self.NORMALIZER, 1.0), -1.0)
        normalized = self._boost_variance(normalized)
        return SentimentResult(
            round(normalized, 3),
            self._label_from_score(normalized),
        )

    def _boost_variance(self, score: float) -> float:
        """Push magnitudes away from zero while preserving sign."""
        magnitude = abs(score)
        if magnitude == 0.0:
            return 0.0
        baseline = max(self.VARIANCE_BASELINE, 1e-6)
        stretched = 1 - math.exp(-(magnitude / baseline))
        return math.copysign(min(stretched, 1.0), score)

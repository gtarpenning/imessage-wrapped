"""
Lightweight tokenization helpers tuned for conversational English text.

We purposely avoid heavy NLP dependencies; this module only normalizes text,
splits sentences, and yields lowercase word tokens.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator, Sequence

__all__ = ["TokenizedMessage", "SimpleTokenizer"]


_WORD_PATTERN = re.compile(r"[A-Za-z0-9']+")
_SENTENCE_BOUNDARY = re.compile(r"[.!?]+")
_APOSTROPHE_VARIANTS = {
    "\u2018": "'",
    "\u2019": "'",
    "\u2032": "'",
    "\u02bc": "'",
}


@dataclass(frozen=True)
class TokenizedMessage:
    tokens: list[str]


class SimpleTokenizer:
    """
    Minimal tokenizer for conversational text.

    * Normalizes curly apostrophes/quotes
    * Lowercases tokens
    * Splits on ASCII punctuation boundaries
    """

    def tokenize_messages(self, messages: Sequence[str]) -> list[TokenizedMessage]:
        return [TokenizedMessage(tokens=self.tokenize(text)) for text in messages if text]

    def tokenize(self, text: str) -> list[str]:
        normalized = self._normalize(text)
        return [match.group(0).lower() for match in _WORD_PATTERN.finditer(normalized)]

    def sentences(self, text: str) -> Iterator[str]:
        normalized = self._normalize(text)
        start = 0
        for match in _SENTENCE_BOUNDARY.finditer(normalized):
            chunk = normalized[start : match.start()].strip()
            if chunk:
                yield chunk
            start = match.end()
        remainder = normalized[start:].strip()
        if remainder:
            yield remainder

    def _normalize(self, text: str) -> str:
        # Replace smart quotes/apostrophes with straight ASCII quotes
        normalized = "".join(_APOSTROPHE_VARIANTS.get(ch, ch) for ch in text)
        # Collapse whitespace to keep window sizes predictable
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized.strip()

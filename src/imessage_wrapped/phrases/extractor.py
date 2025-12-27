from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from importlib import resources
from typing import Iterable, Mapping, Sequence
from collections import Counter

from .tokenizer import SimpleTokenizer, TokenizedMessage
from .scoring import FrequencyScorer, TfIdfScorer, ScoredPhrase

STOPWORDS_PACKAGE = "imessage_wrapped.phrases.resources"
STOPWORDS_FILE = "stopwords_en.txt"

__all__ = [
    "PhraseExtractionConfig",
    "PhraseExtractionResult",
    "PhraseExtractor",
    "PhraseStat",
    "ContactPhraseStats",
]


@dataclass(frozen=True)
class PhraseStat:
    text: str
    occurrences: int
    share: float


@dataclass(frozen=True)
class ContactPhraseStats:
    contact_id: str
    contact_name: str | None
    total_messages: int
    top_phrases: list[PhraseStat] = field(default_factory=list)


@dataclass(frozen=True)
class PhraseExtractionResult:
    overall: list[PhraseStat]
    by_contact: list[ContactPhraseStats]
    analyzed_messages: int
    config: "PhraseExtractionConfig"


@dataclass(frozen=True)
class PhraseExtractionConfig:
    ngram_range: tuple[int, int] = (3, 6)
    min_occurrences: int = 3
    min_characters: int = 4
    min_text_messages: int = 50
    per_contact_min_text_messages: int | None = 20
    max_phrases: int = 10
    per_contact_limit: int = 5
    scoring: str = "frequency"  # or "tfidf"
    dedupe_overlap: bool = True
    overlap_tolerance: float = 0.1
    length_bias: float = 0.45

    def __post_init__(self) -> None:
        if self.ngram_range[0] <= 0 or self.ngram_range[0] > self.ngram_range[1]:
            raise ValueError("ngram_range must be a tuple like (1, 3)")
        if self.min_occurrences < 1:
            raise ValueError("min_occurrences must be >= 1")
        if self.min_characters < 1:
            raise ValueError("min_characters must be >= 1")
        if self.min_text_messages < 1:
            raise ValueError("min_text_messages must be >= 1")
        if self.per_contact_min_text_messages is not None and self.per_contact_min_text_messages < 1:
            raise ValueError("per_contact_min_text_messages must be >= 1")
        if self.max_phrases < 1:
            raise ValueError("max_phrases must be >= 1")
        if self.scoring not in {"frequency", "tfidf"}:
            raise ValueError("scoring must be 'frequency' or 'tfidf'")
        if self.per_contact_limit < 0:
            raise ValueError("per_contact_limit must be >= 0")
        if self.length_bias < 0:
            raise ValueError("length_bias must be >= 0")


class PhraseExtractor:
    def __init__(
        self,
        config: PhraseExtractionConfig | None = None,
        stopwords: Iterable[str] | None = None,
        tokenizer: SimpleTokenizer | None = None,
    ) -> None:
        self._config = config or PhraseExtractionConfig()
        self._tokenizer = tokenizer or SimpleTokenizer()
        self._stopwords = self._build_stopword_set(stopwords)
        self._scorer = self._build_scorer(self._config.scoring)

    @property
    def config(self) -> PhraseExtractionConfig:
        return self._config

    def extract(
        self,
        messages: Sequence[str],
        *,
        per_contact_messages: Mapping[str, Sequence[str]] | None = None,
        contact_names: Mapping[str, str] | None = None,
    ) -> PhraseExtractionResult:
        overall_stats = self._extract_bucket(messages, min_messages=self._config.min_text_messages)

        contact_results: list[ContactPhraseStats] = []
        if per_contact_messages:
            for contact_id, contact_msgs in per_contact_messages.items():
                bucket = self._extract_bucket(
                    contact_msgs,
                    min_messages=(
                        self._config.per_contact_min_text_messages
                        or self._config.min_text_messages
                    ),
                )
                contact_results.append(
                    ContactPhraseStats(
                        contact_id=contact_id,
                        contact_name=(contact_names or {}).get(contact_id),
                        total_messages=bucket.total_messages,
                        top_phrases=self._contact_phrase_slice(bucket.top_phrases),
                    )
                )

            contact_results.sort(
                key=lambda item: (
                    item.top_phrases[0].occurrences if item.top_phrases else 0,
                    item.total_messages,
                ),
                reverse=True,
            )

        return PhraseExtractionResult(
            overall=overall_stats.top_phrases[: self._config.max_phrases],
            by_contact=contact_results,
            analyzed_messages=overall_stats.total_messages,
            config=self._config,
        )

    def _extract_bucket(
        self,
        messages: Sequence[str],
        *,
        min_messages: int | None = None,
    ) -> "PhraseBucket":
        tokenized = self._tokenizer.tokenize_messages(messages)
        min_required = min_messages if min_messages is not None else self._config.min_text_messages
        if len(tokenized) < min_required:
            return PhraseBucket(total_messages=len(tokenized), top_phrases=[])

        counts, doc_frequencies, total_docs = self._count_phrases(tokenized)
        filtered_counts = {
            phrase: count
            for phrase, count in counts.items()
            if count >= self._config.min_occurrences
        }
        if not filtered_counts:
            return PhraseBucket(total_messages=len(tokenized), top_phrases=[])

        total_occurrences = sum(filtered_counts.values())
        scored = self._scorer.score(filtered_counts, doc_frequencies, total_docs)
        ranked = sorted(
            scored,
            key=lambda item: (
                item.score * self._length_multiplier(item.text),
                item.occurrences,
                len(item.text),
                item.text,
            ),
            reverse=True,
        )

        if self._config.dedupe_overlap:
            ranked = self._dedupe_overlaps(ranked)

        phrase_stats = [
            PhraseStat(
                text=item.text,
                occurrences=item.occurrences,
                share=round(item.occurrences / max(1, total_occurrences), 4),
            )
            for item in ranked
        ]

        return PhraseBucket(total_messages=len(tokenized), top_phrases=phrase_stats)

    def _contact_phrase_slice(self, phrases: Sequence[PhraseStat]) -> list[PhraseStat]:
        if self._config.per_contact_limit <= 0:
            return list(phrases)
        return list(phrases[: self._config.per_contact_limit])

    def _count_phrases(
        self,
        tokenized_messages: Sequence[TokenizedMessage],
    ) -> tuple[Counter[str], dict[str, int], int]:
        counts: Counter[str] = Counter()
        doc_frequencies: dict[str, int] = {}

        for message in tokenized_messages:
            seen_in_message: set[str] = set()
            tokens = message.tokens
            for phrase in self._generate_phrases(tokens):
                counts[phrase] += 1
                if phrase not in seen_in_message:
                    doc_frequencies[phrase] = doc_frequencies.get(phrase, 0) + 1
                    seen_in_message.add(phrase)

        return counts, doc_frequencies, len(tokenized_messages)

    def _generate_phrases(self, tokens: Sequence[str]) -> Iterable[str]:
        min_n, max_n = self._config.ngram_range
        length = len(tokens)
        for n in range(min_n, max_n + 1):
            if length < n:
                continue
            for idx in range(length - n + 1):
                window = tokens[idx : idx + n]
                if not self._valid_ngram(window):
                    continue
                yield " ".join(window)

    def _valid_ngram(self, tokens: Sequence[str]) -> bool:
        if not tokens:
            return False
        characters = sum(len(token) for token in tokens)
        if characters < self._config.min_characters:
            return False
        if all(token in self._stopwords for token in tokens):
            return False
        return True

    def _dedupe_overlaps(self, scored: Sequence[ScoredPhrase]) -> list[ScoredPhrase]:
        filtered: list[ScoredPhrase] = []
        for candidate in scored:
            skip = False
            for kept in filtered:
                if self._phrases_overlap(kept.text, candidate.text):
                    count_delta = abs(kept.occurrences - candidate.occurrences)
                    tolerance = max(1, int(kept.occurrences * self._config.overlap_tolerance))
                    if len(candidate.text) <= len(kept.text) and count_delta <= tolerance:
                        skip = True
                        break
            if not skip:
                filtered.append(candidate)
        return filtered

    @staticmethod
    def _phrases_overlap(left: str, right: str) -> bool:
        return left in right or right in left

    def _build_stopword_set(self, stopwords: Iterable[str] | None) -> set[str]:
        if stopwords is not None:
            return {word.strip().lower() for word in stopwords if word.strip()}
        return _load_stopwords()

    def _build_scorer(self, scoring: str):
        if scoring == "tfidf":
            return TfIdfScorer()
        return FrequencyScorer()

    def _length_multiplier(self, phrase: str) -> float:
        token_count = max(1, phrase.count(" ") + 1)
        extra_tokens = max(0, token_count - 1)
        return 1.0 + (self._config.length_bias * extra_tokens)


@dataclass
class PhraseBucket:
    total_messages: int
    top_phrases: list[PhraseStat]


@lru_cache(maxsize=1)
def _load_stopwords() -> set[str]:
    base = resources.files(STOPWORDS_PACKAGE)
    with resources.as_file(base / STOPWORDS_FILE) as path:
        content = path.read_text(encoding="utf-8")
    return {line.strip() for line in content.splitlines() if line.strip()}

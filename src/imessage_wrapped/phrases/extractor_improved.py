"""
Improved phrase deduplication strategies.

This module contains different approaches to balance removing redundant phrases
while keeping meaningful variations.
"""

from typing import Sequence

from .scoring import ScoredPhrase


def dedupe_overlaps_option1_smart_subset(
    scored: Sequence[ScoredPhrase],
    overlap_tolerance: float = 0.1,
) -> list[ScoredPhrase]:
    """
    Option 1: Smart Subset Removal

    Only remove a subset if it has significantly fewer occurrences than the superset.
    If a subset has similar or more occurrences, keep it as it's likely used independently.
    """
    # First pass: filter obvious overlaps with tolerance
    filtered: list[ScoredPhrase] = []
    for candidate in scored:
        skip = False
        for kept in filtered:
            if _phrases_overlap(kept.text, candidate.text):
                count_delta = abs(kept.occurrences - candidate.occurrences)
                tolerance = max(1, int(kept.occurrences * overlap_tolerance))
                if len(candidate.text) <= len(kept.text) and count_delta <= tolerance:
                    skip = True
                    break
        if not skip:
            filtered.append(candidate)

    # Second pass: only remove subsets that have significantly fewer occurrences
    result: list[ScoredPhrase] = []
    for phrase in filtered:
        is_redundant_subset = False
        for other in filtered:
            if phrase != other and phrase.text != other.text:
                if _is_phrase_subset(phrase.text, other.text):
                    # Only remove if the subset has less than 80% of the superset's occurrences
                    count_ratio = phrase.occurrences / max(1, other.occurrences)
                    if count_ratio < 0.8:
                        is_redundant_subset = True
                        break
        if not is_redundant_subset:
            result.append(phrase)

    return result


def dedupe_overlaps_option2_no_subset_removal(
    scored: Sequence[ScoredPhrase],
    overlap_tolerance: float = 0.1,
) -> list[ScoredPhrase]:
    """
    Option 2: No Subset Removal

    Only remove phrases that overlap AND have similar counts.
    Don't do the second subset removal pass at all.
    """
    filtered: list[ScoredPhrase] = []
    for candidate in scored:
        skip = False
        for kept in filtered:
            if _phrases_overlap(kept.text, candidate.text):
                count_delta = abs(kept.occurrences - candidate.occurrences)
                tolerance = max(1, int(kept.occurrences * overlap_tolerance))
                if len(candidate.text) <= len(kept.text) and count_delta <= tolerance:
                    skip = True
                    break
        if not skip:
            filtered.append(candidate)

    return filtered


def dedupe_overlaps_option3_contextual(
    scored: Sequence[ScoredPhrase],
    overlap_tolerance: float = 0.1,
    subset_threshold: float = 1.5,
) -> list[ScoredPhrase]:
    """
    Option 3: Contextual Subset Removal

    Remove subsets only if:
    1. The superset has significantly more occurrences (>1.5x), OR
    2. The subset has very few occurrences relative to the superset
    """
    # First pass: filter obvious overlaps with tolerance
    filtered: list[ScoredPhrase] = []
    for candidate in scored:
        skip = False
        for kept in filtered:
            if _phrases_overlap(kept.text, candidate.text):
                count_delta = abs(kept.occurrences - candidate.occurrences)
                tolerance = max(1, int(kept.occurrences * overlap_tolerance))
                if len(candidate.text) <= len(kept.text) and count_delta <= tolerance:
                    skip = True
                    break
        if not skip:
            filtered.append(candidate)

    # Second pass: contextual subset removal
    result: list[ScoredPhrase] = []
    for phrase in filtered:
        should_remove = False
        for other in filtered:
            if phrase != other and phrase.text != other.text:
                if _is_phrase_subset(phrase.text, other.text):
                    # Remove if superset has significantly more occurrences
                    if other.occurrences > phrase.occurrences * subset_threshold:
                        should_remove = True
                        break
        if not should_remove:
            result.append(phrase)

    return result


def dedupe_overlaps_option4_bidirectional(
    scored: Sequence[ScoredPhrase],
    overlap_tolerance: float = 0.1,
) -> list[ScoredPhrase]:
    """
    Option 4: Bidirectional Check

    Only remove a subset if it's ALSO similar in count to the superset.
    This combines both the overlap logic and subset logic into one pass.
    """
    filtered: list[ScoredPhrase] = []

    for candidate in scored:
        skip = False
        for kept in filtered:
            # Check for overlap
            is_overlap = _phrases_overlap(kept.text, candidate.text)
            is_subset = _is_phrase_subset(candidate.text, kept.text)

            if is_overlap or is_subset:
                count_delta = abs(kept.occurrences - candidate.occurrences)
                tolerance = max(1, int(kept.occurrences * overlap_tolerance))

                # Only skip if shorter/smaller AND counts are similar
                if len(candidate.text) <= len(kept.text) and count_delta <= tolerance:
                    skip = True
                    break

        if not skip:
            filtered.append(candidate)

    return filtered


# Helper functions
def _phrases_overlap(left: str, right: str) -> bool:
    return left in right or right in left


def _is_phrase_subset(shorter: str, longer: str) -> bool:
    if len(shorter) >= len(longer):
        return False
    shorter_words = shorter.split()
    longer_words = longer.split()
    if len(shorter_words) > len(longer_words):
        return False
    for i in range(len(longer_words) - len(shorter_words) + 1):
        if longer_words[i : i + len(shorter_words)] == shorter_words:
            return True
    return False

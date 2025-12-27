"""
Sentiment analysis entry points.

This module deliberately keeps concrete implementations tucked away in
submodules (e.g. lexica.py for lexicon-based scoring) so we can easily
swap in alternative backends like lightweight ML models or ONNX
inference without touching the callers.
"""

from .lexica import LexicalSentimentAnalyzer, SentimentResult

__all__ = [
    "LexicalSentimentAnalyzer",
    "SentimentResult",
]

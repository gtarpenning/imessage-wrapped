"""
Sentiment analysis entry points.

This module deliberately keeps concrete implementations tucked away in
submodules (e.g. lexica.py for lexicon-based scoring) so we can easily
swap in alternative backends like lightweight ML models or ONNX
inference without touching the callers.
"""

from .lexica import LexicalSentimentAnalyzer, SentimentResult
from .onnx_model import DistilBertOnnxSentimentAnalyzer

# Backwards compatibility: keep the old export name until callers migrate.
TinyBertOnnxSentimentAnalyzer = DistilBertOnnxSentimentAnalyzer

__all__ = [
    "LexicalSentimentAnalyzer",
    "SentimentResult",
    "DistilBertOnnxSentimentAnalyzer",
    "TinyBertOnnxSentimentAnalyzer",
]

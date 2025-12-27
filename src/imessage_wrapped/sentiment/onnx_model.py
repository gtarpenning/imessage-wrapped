from __future__ import annotations

import json
import logging
import math
import os
import unicodedata
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Iterable, Sequence

from .lexica import SentimentResult

DISTILBERT_RESOURCE_PACKAGE = "imessage_wrapped.sentiment.resources.distilbert.onnx"
AX1_SEED_PHRASE = "I love you so much and can't wait to hug you."
AX2_SEED_PHRASE = "George washington was the first president of the United States."
SCATTER_AXIS_SEEDS = (
    ("AX1", AX1_SEED_PHRASE),
    ("AX2", AX2_SEED_PHRASE),
)
def _load_sample_rate() -> float:
    raw = os.getenv("IMESSAGE_WRAPPED_SENTIMENT_SUBSAMPLE", "0.25")
    try:
        rate = float(raw)
    except ValueError:
        rate = 0.25
    rate = max(0.0, min(1.0, rate))
    return rate if rate > 0 else 1.0


SENTIMENT_SAMPLE_RATE = _load_sample_rate()

logger = logging.getLogger(__name__)


def _ensure_onnxruntime():
    try:
        import onnxruntime as ort  # type: ignore
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise RuntimeError(
            "onnxruntime is required for the DistilBERT sentiment backend. "
            "Install it with `pip install onnxruntime` (or onnxruntime-silicon on Apple Silicon). "
            "If you already installed it, ensure a NumPy version compatible with the chosen wheel "
            "(onnxruntime<=1.17.x currently expects numpy<2)."
        ) from exc
    return ort


def _load_numpy():
    try:
        import numpy as np  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("numpy is required for ONNX inference") from exc
    return np


def _count_onnx_parameters(model_path: Path) -> int | None:
    try:
        import onnx  # type: ignore
    except Exception:  # pragma: no cover - optional dependency
        logger.debug("onnx package not available; skipping parameter count")
        return None

    try:
        model = onnx.load(str(model_path))
    except Exception:  # pragma: no cover - corrupted model
        logger.warning("Failed to load ONNX model for parameter counting", exc_info=True)
        return None

    total = 0
    for initializer in model.graph.initializer:
        size = 1
        for dim in initializer.dims:
            size *= dim
        total += size
    return total


def _format_param_count(count: int | None) -> str | None:
    if count is None:
        return None
    units = ["", "K", "M", "B"]
    value = float(count)
    unit_index = 0
    while value >= 1000 and unit_index < len(units) - 1:
        value /= 1000.0
        unit_index += 1
    if unit_index == 0:
        return f"{int(value):,}"
    return f"{value:.1f}{units[unit_index]} ({count:,})"


class DistilBertOnnxSentimentAnalyzer:
    """ONNX runtime wrapper around the DistilBERT SST-2 sentiment classifier."""

    def __init__(self, max_length: int = 128, neutral_margin: float = 0.1):
        ort = _ensure_onnxruntime()
        self._np = _load_numpy()
        self._max_length = max_length
        self._neutral_margin = neutral_margin

        base = resources.files(DISTILBERT_RESOURCE_PACKAGE)
        with resources.as_file(base / "model.onnx") as model_path:
            param_count = _count_onnx_parameters(model_path)
            self._session = ort.InferenceSession(
                str(model_path),
                providers=["CPUExecutionProvider"],
            )
        self._input_names = {tensor.name for tensor in self._session.get_inputs()}

        with resources.as_file(base / "config.json") as cfg_path:
            config = json.loads(cfg_path.read_text(encoding="utf-8"))
        self._id2label = {
            int(k): str(v).lower() for k, v in config.get("id2label", {}).items()
        } or {0: "negative", 1: "positive"}
        self._label2id = {v: k for k, v in self._id2label.items()}

        with resources.as_file(base / "tokenizer_config.json") as tk_cfg_path:
            tokenizer_config = json.loads(tk_cfg_path.read_text(encoding="utf-8"))

        with resources.as_file(base / "vocab.txt") as vocab_path:
            vocab = vocab_path.read_text(encoding="utf-8").splitlines()

        self._tokenizer = BertWordPieceTokenizer(
            vocab,
            do_lower_case=bool(tokenizer_config.get("do_lower_case", True)),
        )
        model_name = config.get("_name_or_path") or "DistilBERT"
        self.model_info = {
            "name": model_name,
            "parameters": param_count,
            "parameters_display": _format_param_count(param_count) if param_count else None,
            "max_length": max_length,
        }
        self.axis_seeds = list(SCATTER_AXIS_SEEDS)
        self.sample_rate = SENTIMENT_SAMPLE_RATE
        self.embedding_sample_rate = 1.0
        if self.model_info["parameters_display"]:
            logger.info(
                "Loaded %s sentiment model (%s parameters)",
                model_name,
                self.model_info["parameters_display"],
            )
        self.model_info["axis_seeds"] = self.axis_seeds
        self.model_info["sample_rate"] = self.sample_rate
        self.model_info["embedding_sample_rate"] = self.embedding_sample_rate

        self._axis_vectors: dict[str, Sequence[float]] = {}
        for axis_id, phrase in self.axis_seeds:
            _, axis_embedding = self._analyze(text=phrase, include_embedding=True)
            if axis_embedding:
                normalized = self._normalize_vector(axis_embedding)
                if normalized is not None:
                    self._axis_vectors[axis_id] = normalized

    def analyze(self, text: str | None) -> SentimentResult:
        result, _ = self._analyze(text=text, include_embedding=False)
        return result

    def analyze_with_embedding(self, text: str | None) -> tuple[SentimentResult, list[float] | None]:
        return self._analyze(text=text, include_embedding=True)

    def project_embedding(self, embedding: Sequence[float]) -> dict[str, float]:
        if not self._axis_vectors:
            return {}
        normalized = self._normalize_vector(embedding)
        if normalized is None:
            return {}
        coords = {}
        for axis_id, axis_vector in self._axis_vectors.items():
            coords[axis_id] = float(self._np.dot(normalized, axis_vector))
        return coords

    def _analyze(
        self, text: str | None, include_embedding: bool
    ) -> tuple[SentimentResult, list[float] | None]:
        if not text:
            return SentimentResult(0.0, "neutral"), None

        logits = self._infer_logits(text)
        probs = self._softmax(logits)

        pos_idx = self._label2id.get("positive", self._label2id.get("pos"))
        neg_idx = self._label2id.get("negative", self._label2id.get("neg"))
        if pos_idx is None or neg_idx is None:
            pos_idx, neg_idx = 1, 0
        pos_prob = float(probs[pos_idx])
        neg_prob = float(probs[neg_idx])

        score = pos_prob - neg_prob  # Map to roughly [-1, 1]

        if abs(score) < self._neutral_margin:
            label = "neutral"
        else:
            label = "positive" if score > 0 else "negative"

        embedding = logits.tolist() if include_embedding else None
        return SentimentResult(round(score, 3), label), embedding

    def _infer_logits(self, text: str) -> Sequence[float]:
        encoding = self._tokenizer.encode(text, max_length=self._max_length)
        ort_inputs = {
            "input_ids": self._np.array([encoding.input_ids], dtype=self._np.int64),
            "attention_mask": self._np.array([encoding.attention_mask], dtype=self._np.int64),
        }
        if "token_type_ids" in self._input_names:
            ort_inputs["token_type_ids"] = self._np.array(
                [encoding.token_type_ids], dtype=self._np.int64
            )

        logits = self._session.run(None, ort_inputs)[0][0]
        return logits

    def _softmax(self, logits: Sequence[float]) -> Sequence[float]:
        max_logit = max(logits)
        exps = [math.exp(logit - max_logit) for logit in logits]
        total = sum(exps)
        return [value / total for value in exps]

    def _normalize_vector(self, values: Sequence[float] | None) -> Sequence[float] | None:
        if not values:
            return None
        vector = self._np.array(values, dtype=self._np.float32)
        norm = self._np.linalg.norm(vector)
        if norm == 0:
            return None
        return vector / norm


@dataclass
class Encoding:
    input_ids: list[int]
    attention_mask: list[int]
    token_type_ids: list[int]


class BertWordPieceTokenizer:
    def __init__(self, vocab_tokens: Iterable[str], do_lower_case: bool = True):
        self.vocab = {token: idx for idx, token in enumerate(vocab_tokens)}
        self.inv_vocab = {idx: token for token, idx in self.vocab.items()}

        self.unk_token = "[UNK]"
        self.cls_token = "[CLS]"
        self.sep_token = "[SEP]"
        self.pad_token = "[PAD]"

        self.unk_token_id = self.vocab.get(self.unk_token, 100)
        self.cls_token_id = self.vocab.get(self.cls_token, 101)
        self.sep_token_id = self.vocab.get(self.sep_token, 102)
        self.pad_token_id = self.vocab.get(self.pad_token, 0)

        self.basic_tokenizer = BasicTokenizer(do_lower_case=do_lower_case)
        self.wordpiece_tokenizer = WordPieceTokenizer(vocab=self.vocab, unk_token=self.unk_token)

    def encode(self, text: str, max_length: int) -> Encoding:
        tokens = self.tokenize(text)
        # Reserve space for CLS/SEP
        tokens = tokens[: max_length - 2]
        tokens = [self.cls_token] + tokens + [self.sep_token]

        input_ids = [self.vocab.get(tok, self.unk_token_id) for tok in tokens]
        attention_mask = [1] * len(input_ids)
        token_type_ids = [0] * len(input_ids)

        padding_length = max_length - len(input_ids)
        if padding_length > 0:
            input_ids.extend([self.pad_token_id] * padding_length)
            attention_mask.extend([0] * padding_length)
            token_type_ids.extend([0] * padding_length)

        return Encoding(
            input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids
        )

    def tokenize(self, text: str) -> list[str]:
        split_tokens: list[str] = []
        for token in self.basic_tokenizer.tokenize(text):
            split_tokens.extend(self.wordpiece_tokenizer.tokenize(token))
        return split_tokens


class BasicTokenizer:
    def __init__(self, do_lower_case: bool = True):
        self.do_lower_case = do_lower_case

    def tokenize(self, text: str) -> list[str]:
        text = self._clean_text(text)
        text = self._tokenize_chinese_chars(text)
        orig_tokens = self._whitespace_tokenize(text)
        split_tokens: list[str] = []
        for token in orig_tokens:
            if self.do_lower_case:
                token = token.lower()
                token = self._strip_accents(token)
            split_tokens.extend(self._split_on_punc(token))
        return self._whitespace_tokenize(" ".join(split_tokens))

    def _strip_accents(self, text: str) -> str:
        text = unicodedata.normalize("NFD", text)
        output = []
        for char in text:
            if unicodedata.category(char) == "Mn":
                continue
            output.append(char)
        return "".join(output)

    def _split_on_punc(self, text: str) -> list[str]:
        if not text:
            return []
        chars = list(text)
        output: list[list[str]] = []
        current_token: list[str] = []
        for char in chars:
            if self._is_punctuation(char):
                if current_token:
                    output.append(current_token)
                    current_token = []
                output.append([char])
            else:
                current_token.append(char)
        if current_token:
            output.append(current_token)
        return ["".join(token) for token in output]

    def _is_punctuation(self, char: str) -> bool:
        cp = ord(char)
        if (33 <= cp <= 47) or (58 <= cp <= 64) or (91 <= cp <= 96) or (123 <= cp <= 126):
            return True
        cat = unicodedata.category(char)
        return cat.startswith("P")

    def _tokenize_chinese_chars(self, text: str) -> str:
        output = []
        for char in text:
            cp = ord(char)
            if self._is_chinese_char(cp):
                output.extend([" ", char, " "])
            else:
                output.append(char)
        return "".join(output)

    def _is_chinese_char(self, cp: int) -> bool:
        return (
            0x4E00 <= cp <= 0x9FFF
            or 0x3400 <= cp <= 0x4DBF
            or 0x20000 <= cp <= 0x2A6DF
            or 0x2A700 <= cp <= 0x2B73F
            or 0x2B740 <= cp <= 0x2B81F
            or 0x2B820 <= cp <= 0x2CEAF
            or 0xF900 <= cp <= 0xFAFF
            or 0x2F800 <= cp <= 0x2FA1F
        )

    def _clean_text(self, text: str) -> str:
        output = []
        for char in text:
            cp = ord(char)
            if cp in (0, 0xFFFD) or self._is_control(char):
                continue
            if self._is_whitespace(char):
                output.append(" ")
            else:
                output.append(char)
        return "".join(output)

    def _is_control(self, char: str) -> bool:
        if char in ("\t", "\n", "\r"):
            return False
        return unicodedata.category(char) in ("Cc", "Cf")

    def _is_whitespace(self, char: str) -> bool:
        if char in (" ", "\t", "\n", "\r"):
            return True
        return unicodedata.category(char) == "Zs"

    def _whitespace_tokenize(self, text: str) -> list[str]:
        text = text.strip()
        if not text:
            return []
        return text.split()


class WordPieceTokenizer:
    def __init__(
        self, vocab: dict[str, int], unk_token: str = "[UNK]", max_input_chars_per_word: int = 100
    ):
        self.vocab = vocab
        self.unk_token = unk_token
        self.max_input_chars_per_word = max_input_chars_per_word

    def tokenize(self, text: str) -> list[str]:
        if not text:
            return []
        output_tokens: list[str] = []
        for token in self._whitespace_tokenize(text):
            chars = list(token)
            if len(chars) > self.max_input_chars_per_word:
                output_tokens.append(self.unk_token)
                continue

            is_bad = False
            start = 0
            sub_tokens: list[str] = []
            while start < len(chars):
                end = len(chars)
                cur_substr = None
                while start < end:
                    substr = "".join(chars[start:end])
                    if start > 0:
                        substr = "##" + substr
                    if substr in self.vocab:
                        cur_substr = substr
                        break
                    end -= 1
                if cur_substr is None:
                    is_bad = True
                    break
                sub_tokens.append(cur_substr)
                start = end
            if is_bad:
                output_tokens.append(self.unk_token)
            else:
                output_tokens.extend(sub_tokens)
        return output_tokens

    def _whitespace_tokenize(self, text: str) -> list[str]:
        text = text.strip()
        if not text:
            return []
        return text.split()

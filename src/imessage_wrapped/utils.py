from __future__ import annotations

import os
import pwd
from collections import Counter
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

import emoji

APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)
TIMESTAMP_FACTOR = 1_000_000_000

TAPBACK_MAP = {
    2000: "love",
    2001: "like",
    2002: "dislike",
    2003: "laugh",
    2004: "emphasize",
    2005: "question",
}

EMOJI_JOINERS_AND_MODIFIERS = {
    "\u200d",
    "\ufe0f",
    "\ufe0e",
    "\u20e3",
}

EXCLUDED_EMOJIS = {
    "\ufffc",
    "\u2642",
    "\u2642\ufe0f",
    "\u2640",
    "\u2640\ufe0f",
    "\ufe0f",
}

PLACEHOLDER_NAMES = {
    "System Administrator",
    "System Administrator's",
    "System Administrator’s",
    "Administrator",
    "root",
}


def _gecos_or_username(username: str | None) -> str | None:
    if not username:
        return None

    try:
        info = pwd.getpwnam(username)
        full_name = info.pw_gecos.split(",")[0].strip()
        if full_name and full_name not in PLACEHOLDER_NAMES:
            return full_name
    except KeyError:
        # No entry found for this username
        pass
    except Exception:
        return None

    if username not in PLACEHOLDER_NAMES:
        return username
    return None


def get_user_full_name() -> str:
    """
    Try multiple sources for a friendly user name, preferring the invoking user
    when running under sudo.
    """
    candidates: list[str | None] = [
        os.environ.get("SUDO_USER"),
        os.environ.get("LOGNAME"),
        os.environ.get("USER"),
        os.environ.get("USERNAME"),
    ]

    try:
        candidates.append(os.getlogin())
    except Exception:
        pass

    try:
        candidates.append(pwd.getpwuid(os.getuid()).pw_name)
    except Exception:
        pass

    seen = set()
    for candidate in candidates:
        if candidate and candidate not in seen:
            seen.add(candidate)
            resolved = _gecos_or_username(candidate)
            if resolved:
                return resolved

    return "User"


def apple_timestamp_to_datetime(ns: int) -> datetime | None:
    if ns is None or ns == 0:
        return None
    seconds = ns / TIMESTAMP_FACTOR
    return APPLE_EPOCH + timedelta(seconds=seconds)


def datetime_to_apple_timestamp(dt: datetime) -> int:
    seconds = (dt - APPLE_EPOCH).total_seconds()
    return int(seconds * TIMESTAMP_FACTOR)


def calculate_read_duration(date: int, date_read: int) -> float | None:
    if not date_read or date_read <= date:
        return None
    diff_ns = date_read - date
    return diff_ns / TIMESTAMP_FACTOR


def readable_duration(seconds: float) -> str:
    if seconds < 60:
        s = int(seconds)
        return f"{s} second{'s' if s != 1 else ''}"

    parts = []
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)

    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    if secs > 0 and hours == 0:
        parts.append(f"{secs} second{'s' if secs != 1 else ''}")

    return ", ".join(parts)


def is_tapback(associated_message_type: int | None) -> bool:
    if associated_message_type is None:
        return False
    return 2000 <= associated_message_type <= 2005 or 3000 <= associated_message_type <= 3005


def get_tapback_type(associated_message_type: int) -> str | None:
    return TAPBACK_MAP.get(associated_message_type)


def strip_guid_prefix(guid: str | None) -> str | None:
    if not guid:
        return None
    if "/" in guid:
        return guid.split("/", 1)[1]
    elif ":" in guid:
        return guid.split(":", 1)[1]
    return guid


def extract_text_from_attributed_body(blob: bytes) -> str | None:
    if not blob:
        return None
    try:
        import re

        ns_string_pattern = rb"NSString\x01\x94\x84\x01.(.+?)\x86\x84\x02"
        match = re.search(ns_string_pattern, blob, re.DOTALL)

        if match:
            text_bytes = match.group(1)
            text = text_bytes.decode("utf-8", errors="replace")

            cleaned = "".join(
                c
                for c in text
                if (
                    c.isprintable()
                    or c in "\n\r\t "
                    or ord(c) >= 0x1F300
                    or c in EMOJI_JOINERS_AND_MODIFIERS
                )
                and c != "�"
            )
            if len(cleaned) > 0:
                return cleaned.strip()

        return None
    except Exception:
        return None


def count_emojis(text: str) -> Counter:
    if not text:
        return Counter()

    extracted = emoji.emoji_list(text)
    emojis = []
    for item in extracted:
        emoji_char = item["emoji"]
        if emoji_char in EXCLUDED_EMOJIS:
            continue
        emojis.append(emoji_char)

    return Counter(emojis)


def extract_hydrated_contact_data(statistics: dict[str, Any]) -> dict[str, Any]:
    """
    Extract contact-specific data that needs to be hydrated (with real names).

    Returns a dictionary containing paths and values of fields that contain contact names.
    This data can be used to "rehydrate" sanitized statistics when the user unlocks.
    """
    hydrated_data = {}

    def _extract_contact_fields(node: Any, path: str = "") -> None:
        if isinstance(node, dict):
            # Extract top_sent_to and top_received_from arrays with names
            if "top_sent_to" in node and isinstance(node["top_sent_to"], list):
                hydrated_data[f"{path}.top_sent_to"] = [
                    {"name": item.get("name"), "count": item.get("count")}
                    for item in node["top_sent_to"]
                    if isinstance(item, dict) and item.get("name")
                ]

            if "top_received_from" in node and isinstance(node["top_received_from"], list):
                hydrated_data[f"{path}.top_received_from"] = [
                    {"name": item.get("name"), "count": item.get("count")}
                    for item in node["top_received_from"]
                    if isinstance(item, dict) and item.get("name")
                ]

            # Extract message_distribution with contact names
            if "message_distribution" in node and isinstance(node["message_distribution"], list):
                dist = []
                for idx, entry in enumerate(node["message_distribution"]):
                    if isinstance(entry, dict):
                        item = {}
                        if "contact_name" in entry:
                            item["contact_name"] = entry["contact_name"]
                        if "contact_id" in entry:
                            item["contact_id"] = entry["contact_id"]
                        if item:
                            item["index"] = idx
                            dist.append(item)
                if dist:
                    hydrated_data[f"{path}.message_distribution"] = dist

            # Extract cliffhanger examples
            cliff = node.get("cliffhangers")
            if isinstance(cliff, dict):
                if "examples" in cliff and cliff["examples"]:
                    hydrated_data[f"{path}.cliffhangers.examples"] = cliff["examples"]
                if "examples_them" in cliff and cliff["examples_them"]:
                    hydrated_data[f"{path}.cliffhangers.examples_them"] = cliff["examples_them"]

            # Extract temporal MVP info
            if "temporal" in node and isinstance(node["temporal"], dict):
                temporal = node["temporal"]
                if "weekday_mvp" in temporal and temporal["weekday_mvp"]:
                    hydrated_data[f"{path}.temporal.weekday_mvp"] = temporal["weekday_mvp"]
                if "weekend_mvp" in temporal and temporal["weekend_mvp"]:
                    hydrated_data[f"{path}.temporal.weekend_mvp"] = temporal["weekend_mvp"]

            # Extract longest_streak_contact
            if "longest_streak_contact" in node and node["longest_streak_contact"]:
                hydrated_data[f"{path}.longest_streak_contact"] = node["longest_streak_contact"]

            # Extract ghost stats
            if "ghosts" in node and isinstance(node["ghosts"], dict):
                ghosts = node["ghosts"]
                if "top_left_unread" in ghosts and isinstance(ghosts["top_left_unread"], list):
                    contacts = []
                    for item in ghosts["top_left_unread"]:
                        if isinstance(item, dict) and item.get("contact_name"):
                            contacts.append(
                                {
                                    "contact_name": item["contact_name"],
                                    "count": item.get("count", 0),
                                }
                            )
                    if contacts:
                        hydrated_data[f"{path}.ghosts.top_left_unread"] = contacts

                if "top_left_you_hanging" in ghosts and isinstance(
                    ghosts["top_left_you_hanging"], list
                ):
                    contacts = []
                    for item in ghosts["top_left_you_hanging"]:
                        if isinstance(item, dict) and item.get("contact_name"):
                            contacts.append(
                                {
                                    "contact_name": item["contact_name"],
                                    "count": item.get("count", 0),
                                }
                            )
                    if contacts:
                        hydrated_data[f"{path}.ghosts.top_left_you_hanging"] = contacts

            # Recursively process nested dicts
            for key, value in node.items():
                if isinstance(value, (dict, list)) and key not in [
                    "top_sent_to",
                    "top_received_from",
                    "message_distribution",
                    "cliffhangers",
                    "temporal",
                    "ghosts",
                ]:
                    new_path = f"{path}.{key}" if path else key
                    _extract_contact_fields(value, new_path)
        elif isinstance(node, list):
            for idx, item in enumerate(node):
                if isinstance(item, dict):
                    _extract_contact_fields(item, f"{path}[{idx}]")

    _extract_contact_fields(statistics)
    return hydrated_data


def sanitize_statistics_for_export(statistics: dict[str, Any]) -> dict[str, Any]:
    """
    Return a deep-copied statistics object with privacy-sensitive fields stripped.

    Currently removes per-contact phrase breakdowns so uploads never contain
    potentially identifying content.
    """

    def _strip_private_fields(node: Any) -> None:
        if isinstance(node, dict):
            if "_phrases_by_contact" in node:
                node.pop("_phrases_by_contact", None)
            if "message_distribution" in node and isinstance(node["message_distribution"], list):
                for entry in node["message_distribution"]:
                    if isinstance(entry, dict):
                        entry.pop("contact_name", None)
                        entry.pop("contact_id", None)
            cliff = node.get("cliffhangers")
            if isinstance(cliff, dict):
                cliff.pop("examples", None)
                cliff.pop("examples_them", None)
            if "temporal" in node and isinstance(node["temporal"], dict):
                node["temporal"].pop("weekday_mvp", None)
                node["temporal"].pop("weekend_mvp", None)
            for value in node.values():
                _strip_private_fields(value)
        elif isinstance(node, list):
            for item in node:
                _strip_private_fields(item)

    cleaned = deepcopy(statistics)
    _strip_private_fields(cleaned)
    return cleaned

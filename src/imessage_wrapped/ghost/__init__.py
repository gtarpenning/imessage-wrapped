"""
Ghost conversation utilities.

This package keeps the logic for identifying spammy conversations and
classifying "ghost" style interactions isolated from the main analyzer.
The analyzer can freely compose the filters and metrics exposed here
without needing to know the implementation details.
"""

from .filters import (
    ConversationFilter,
    apply_conversation_filters,
    minimum_responses_filter,
    minimum_total_messages_filter,
    received_to_sent_ratio_filter,
)
from .metrics import GhostStats, compute_ghost_stats

__all__ = [
    "ConversationFilter",
    "apply_conversation_filters",
    "minimum_responses_filter",
    "minimum_total_messages_filter",
    "received_to_sent_ratio_filter",
    "GhostStats",
    "compute_ghost_stats",
]

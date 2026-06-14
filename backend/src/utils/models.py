"""
Data models for the email automation system.
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class EmailCategory(str, Enum):
    SPAM = "SPAM"
    MARKETING = "MARKETING"
    SOCIAL = "SOCIAL"
    OLD_READ = "OLD_READ"
    KEEP = "KEEP"
    UNKNOWN = "UNKNOWN"  # Fallback if Claude response is malformed


DELETE_CATEGORIES = {
    EmailCategory.SPAM,
    EmailCategory.MARKETING,
    EmailCategory.SOCIAL,
    EmailCategory.OLD_READ,
}


@dataclass
class Email:
    """Represents an email fetched from any provider."""
    id: str                          # Provider-specific ID (Gmail message ID or IMAP UID)
    account_name: str
    subject: str
    sender: str
    date: datetime
    is_read: bool
    snippet: str                     # First ~200 chars — no full body needed
    labels: list = field(default_factory=list)      # Gmail labels or IMAP flags
    raw_headers: dict = field(default_factory=dict)  # Raw email headers (List-Unsubscribe, Precedence, etc.)
    size_bytes: int = 0                              # Gmail sizeEstimate in bytes


@dataclass
class ClassificationResult:
    """Result of classifying one email."""
    email_id: str
    category: EmailCategory
    confidence: str                  # "high" | "medium" | "low"
    reasoning: str                   # One-sentence explanation from Claude
    action_taken: str                # "deleted" | "kept" | "dry_run_would_delete" | "skipped_error"


@dataclass
class RunStats:
    """Statistics for a single account run."""
    account: str
    fetched: int = 0
    pre_classified: int = 0          # OLD_READ emails skipped AI
    classified: int = 0              # Emails sent to Claude
    deleted: int = 0
    kept: int = 0
    errors: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    estimated_cost_usd: float = 0.0
    error_message: Optional[str] = None

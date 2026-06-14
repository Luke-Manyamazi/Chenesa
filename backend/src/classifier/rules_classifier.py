"""
Rules-based email classifier — zero AI cost.

Detects MARKETING, SOCIAL, and SPAM using email headers and known patterns.
Runs before Claude so the AI is only invoked on emails rules cannot resolve.

Estimated coverage per category:
- MARKETING: ~90%+ via List-Unsubscribe / Precedence / known bulk mailer headers
- SOCIAL:    ~98%  via sender domain matching against known social platforms
- SPAM:      ~70%  via subject-line pattern matching

All unmatched emails are passed back to the caller — either for Claude
(Pro Smart mode) or returned as KEEP (Free / Aggressive mode).
"""
import re
from typing import Optional

from loguru import logger

from src.utils.models import ClassificationResult, Email, EmailCategory


# ──────────────────────────────────────────────────────────────────────────────
# Known signal lists
# ──────────────────────────────────────────────────────────────────────────────

SOCIAL_SENDER_DOMAINS = frozenset({
    "facebook.com", "facebookmail.com",
    "twitter.com", "x.com",
    "linkedin.com",
    "instagram.com", "mail.instagram.com",
    "pinterest.com",
    "youtube.com",
    "tiktok.com",
    "snapchat.com",
    "reddit.com",
    "tumblr.com",
    "discord.com",
    "twitch.tv",
    "quora.com",
    "medium.com",
})

KNOWN_BULK_MAILER_SUBSTRINGS = (
    "mailchimp", "sendgrid", "constantcontact", "mailgun",
    "campaign-monitor", "campaignmonitor", "klaviyo", "hubspot",
    "brevo", "sendinblue", "aweber", "activecampaign",
    "getresponse", "drip", "mailerlite", "omnisend",
    "salesforce", "marketo", "pardot", "exacttarget", "eloqua",
    "postmark", "sparkpost",
)

_SPAM_SUBJECT_RE = re.compile(
    r"(you('ve| have) won"
    r"|congratulations.{0,30}(winner|selected)"
    r"|claim.{0,20}(prize|reward|gift)"
    r"|free.{0,10}(gift|iphone|cash|money)"
    r"|win.{0,10}(cash|\$)"
    r"|\blottery\b|\bjackpot\b"
    r"|\$\d+.{0,10}free"
    r"|urgent.{0,20}action"
    r"|account.{0,20}(suspended|disabled|blocked)"
    r"|verify.{0,20}immediately"
    r"|password.{0,20}(compromised|expired|reset immediately)"
    r"|unusual.{0,20}sign.{0,10}in"
    r"|click here to (claim|verify|confirm))",
    re.IGNORECASE,
)


# ──────────────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────────────

def _sender_domain(sender: str) -> str:
    """Extract lowercase domain from 'Name <user@domain.com>' or 'user@domain.com'."""
    match = re.search(r"@([\w.\-]+)", sender or "")
    return match.group(1).lower() if match else ""


# ──────────────────────────────────────────────────────────────────────────────
# Classifier
# ──────────────────────────────────────────────────────────────────────────────

class RulesClassifier:
    """
    Classify emails deterministically using email headers and patterns.

    Usage:
        clf = RulesClassifier()
        results, unmatched = clf.classify_batch(emails)
        # results  → list[ClassificationResult] for emails rules resolved
        # unmatched → list[Email] to pass to Claude (or mark as KEEP for free tier)
    """

    def classify_batch(
        self,
        emails: list[Email],
        old_read_threshold_days: int = 180,
        dry_run: bool = False,
    ) -> tuple[list[ClassificationResult], list[Email]]:
        """
        Classify all emails in `emails` using rules.

        Returns:
            (results, unmatched) — ClassificationResults for matched emails,
            and the remaining emails that rules could not resolve.
        """
        results: list[ClassificationResult] = []
        unmatched: list[Email] = []

        for email in emails:
            result = self._classify_one(email, dry_run)
            if result is not None:
                results.append(result)
            else:
                unmatched.append(email)

        if emails:
            pct = len(results) / len(emails) * 100
            logger.info(
                f"Rules engine: {len(results)}/{len(emails)} classified "
                f"({pct:.0f}%), {len(unmatched)} unresolved"
            )

        return results, unmatched

    # ──────────────────────────────────────────────────────────────────────────
    # Per-email detection
    # ──────────────────────────────────────────────────────────────────────────

    def _classify_one(self, email: Email, dry_run: bool) -> Optional[ClassificationResult]:
        """Return a ClassificationResult if any rule matched, else None."""
        category, reasoning = self._detect(email)
        if category is None:
            return None

        if category in (EmailCategory.SPAM, EmailCategory.MARKETING, EmailCategory.SOCIAL):
            action = "dry_run_would_delete" if dry_run else "pending_delete"
        else:
            action = "kept"

        return ClassificationResult(
            email_id=email.id,
            category=category,
            confidence="high",
            reasoning=f"Rules engine: {reasoning}",
            action_taken=action,
        )

    def _detect(self, email: Email) -> tuple[Optional[EmailCategory], str]:
        """
        Check signals in priority order. Returns (category, reasoning) or (None, "").

        Priority:
        1. List-Unsubscribe header → MARKETING (highest confidence signal)
        2. Precedence: bulk/list/junk → MARKETING
        3. X-Mailer matches known bulk sender → MARKETING
        4. X-Campaign-Id present → MARKETING
        5. Sender domain matches known social platform → SOCIAL
        6. Subject matches spam pattern → SPAM
        """
        headers = email.raw_headers

        # 1. List-Unsubscribe — the gold-standard signal for bulk/marketing mail
        if headers.get("list-unsubscribe") or headers.get("list-unsubscribe-post"):
            return EmailCategory.MARKETING, "List-Unsubscribe header present — bulk/marketing email"

        # 2. Precedence: bulk / list / junk
        precedence = (headers.get("precedence") or "").strip().lower()
        if precedence in ("bulk", "list", "junk"):
            return EmailCategory.MARKETING, f"Precedence: {precedence} — automated mailing list"

        # 3. X-Mailer identifies a known bulk-email platform
        mailer = (headers.get("x-mailer") or "").lower()
        for pattern in KNOWN_BULK_MAILER_SUBSTRINGS:
            if pattern in mailer:
                return EmailCategory.MARKETING, f"X-Mailer identifies bulk sender ({mailer[:60]})"

        # 4. Campaign tracking header present
        if headers.get("x-campaign-id") or headers.get("x-campaignid"):
            return EmailCategory.MARKETING, "X-Campaign-Id header present — marketing campaign"

        # 5. Social notification from known platform
        domain = _sender_domain(email.sender or "")
        if domain in SOCIAL_SENDER_DOMAINS:
            return EmailCategory.SOCIAL, f"Social notification from {domain}"

        # 6. Spam subject pattern
        subject = email.subject or ""
        if _SPAM_SUBJECT_RE.search(subject):
            snippet = subject[:80]
            return EmailCategory.SPAM, f"Spam pattern in subject: {snippet!r}"

        return None, ""

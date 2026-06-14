"""
Inbox Storage Analyzer — Phase 2.

Fetches Gmail metadata, categorises emails using the rules engine and
OLD_READ pre-classifier, then aggregates storage usage by category.

No Claude / AI involved — pure rules-based analysis.
"""
import asyncio
import json
import re
from collections import defaultdict
from datetime import datetime, timezone

from loguru import logger

from src.accounts.gmail import GmailAccount
from src.classifier.rules_classifier import RulesClassifier
from src.cleaner.email_cleaner import EmailCleaner
from src.utils.rate_limiter import RateLimiter

from ..db.supabase import get_supabase
from ..services.encryption import decrypt

MAX_ANALYSIS_EMAILS = 1000  # Balance between accuracy and speed (~50s at 20 req/s)

RECOVERABLE_CATEGORIES = {"marketing", "social", "spam", "old_read"}


def _clean_sender(sender: str) -> str:
    """Extract bare email address from 'Name <addr>' or plain address."""
    match = re.search(r"<([^>]+)>", sender or "")
    return (match.group(1) if match else (sender or "")).lower().strip()


async def run_analysis(user_id: str, account_id: str, analysis_id: str) -> None:
    supabase = get_supabase()

    try:
        # ── 1. Fetch account ──────────────────────────────────────────────────
        acc_row = (
            supabase.table("email_accounts")
            .select("*")
            .eq("id", account_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not acc_row.data:
            raise ValueError(f"Account {account_id} not found")
        acc = acc_row.data

        if acc["type"] != "gmail":
            raise ValueError("Only Gmail accounts are supported for analysis")

        # ── 2. Fetch profile (OLD_READ threshold) + keep rules ────────────────
        profile_row = (
            supabase.table("profiles")
            .select("old_read_days")
            .eq("id", user_id)
            .single()
            .execute()
        )
        old_read_threshold = (profile_row.data or {}).get("old_read_days") or 180

        rules_row = (
            supabase.table("keep_rules")
            .select("keyword, match_field")
            .eq("user_id", user_id)
            .execute()
        )
        keep_rules = [(r["keyword"], r["match_field"]) for r in (rules_row.data or [])]

        # ── 3. Build Gmail account ────────────────────────────────────────────
        rate_limiter = RateLimiter(gmail_rps=20, anthropic_rpm=1)
        decrypted = decrypt(acc["encrypted_token"])
        token_data = json.loads(decrypted)

        import google.oauth2.credentials
        creds = google.oauth2.credentials.Credentials(
            token=token_data["token"],
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id"),
            client_secret=token_data.get("client_secret"),
        )
        email_account = GmailAccount(
            account_name=acc["email"],
            email_address=acc["email"],
            token_file="",
            credentials_file="",
            rate_limiter=rate_limiter,
        )

        def _patched_auth():
            from googleapiclient.discovery import build
            email_account._service = build("gmail", "v1", credentials=creds)
            logger.info(f"[analysis:{acc['email']}] Gmail authenticated ✓")

        email_account.authenticate = _patched_auth  # type: ignore

        # ── 4. Run analysis pipeline in thread ───────────────────────────────
        def _run_sync() -> dict:
            email_account.authenticate()

            all_emails = email_account.fetch_emails(max_count=MAX_ANALYSIS_EMAILS)
            total_emails = len(all_emails)

            if not all_emails:
                email_account.close()
                return {
                    "total_emails": 0,
                    "total_size_bytes": 0,
                    "recoverable_size_bytes": 0,
                    "breakdown": {},
                    "top_senders": [],
                }

            # Map email_id → category for every email
            email_categories: dict[str, str] = {}

            # Step A: Keep rules → "other" (protected, not recoverable)
            remaining = all_emails[:]
            if keep_rules:
                remaining, force_kept = EmailCleaner._apply_keep_rules(remaining, keep_rules)
                for e in force_kept:
                    email_categories[e.id] = "other"

            # Step B: OLD_READ pre-classification
            after_old_read = []
            now = datetime.utcnow()
            for email in remaining:
                if not email.date:
                    after_old_read.append(email)
                    continue
                age_days = (now - email.date.replace(tzinfo=None)).days
                if (
                    email.is_read
                    and age_days >= old_read_threshold
                    and not EmailCleaner._is_payslip(email)
                ):
                    email_categories[email.id] = "old_read"
                else:
                    after_old_read.append(email)

            # Step C: Rules engine (headers, domains, patterns)
            rules_clf = RulesClassifier()
            rules_results, unmatched = rules_clf.classify_batch(
                after_old_read, old_read_threshold_days=old_read_threshold
            )
            for result in rules_results:
                email_categories[result.email_id] = result.category.value.lower()
            for email in unmatched:
                email_categories[email.id] = "other"

            # Step D: Aggregate counts + sizes per category
            breakdown: dict[str, dict] = defaultdict(lambda: {"count": 0, "size_bytes": 0})
            total_size = 0
            recoverable_size = 0

            sender_totals: dict[str, dict] = defaultdict(lambda: {"count": 0, "size_bytes": 0})

            for email in all_emails:
                cat = email_categories.get(email.id, "other")
                breakdown[cat]["count"] += 1
                breakdown[cat]["size_bytes"] += email.size_bytes
                total_size += email.size_bytes
                if cat in RECOVERABLE_CATEGORIES:
                    recoverable_size += email.size_bytes

                sender = _clean_sender(email.sender)
                if sender:
                    sender_totals[sender]["count"] += 1
                    sender_totals[sender]["size_bytes"] += email.size_bytes

            # Top 10 senders by storage consumption
            top_senders = sorted(
                [
                    {"sender": k, "count": v["count"], "size_bytes": v["size_bytes"]}
                    for k, v in sender_totals.items()
                ],
                key=lambda x: x["size_bytes"],
                reverse=True,
            )[:10]

            email_account.close()

            return {
                "total_emails": total_emails,
                "total_size_bytes": total_size,
                "recoverable_size_bytes": recoverable_size,
                "breakdown": dict(breakdown),
                "top_senders": top_senders,
            }

        data = await asyncio.to_thread(_run_sync)

        # ── 5. Persist results ────────────────────────────────────────────────
        supabase.table("inbox_analyses").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "total_emails": data["total_emails"],
            "total_size_bytes": data["total_size_bytes"],
            "recoverable_size_bytes": data["recoverable_size_bytes"],
            "breakdown": data["breakdown"],
            "top_senders": data["top_senders"],
        }).eq("id", analysis_id).execute()

        logger.info(
            f"Analysis {analysis_id} complete — "
            f"{data['total_emails']} emails, "
            f"{data['recoverable_size_bytes']:,} bytes recoverable"
        )

    except Exception as exc:
        logger.error(f"Analysis {analysis_id} failed: {exc}", exc_info=True)
        supabase.table("inbox_analyses").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": str(exc),
        }).eq("id", analysis_id).execute()
        raise

"""
Cleaning service — orchestrates the Gmail cleanup pipeline for one user+account.

Pipeline (rules-first architecture):
  1. Keep rules (user keywords — highest priority, skip all other steps)
  2. OLD_READ pre-classification (age + read status, no AI)
  3. Rules engine (headers, sender domains, subject patterns, no AI)
  4. Claude Smart Cleanup (Pro plan + smart mode only)
  5. Execute: archive (safe mode) or trash (aggressive / smart mode)
  6. Persist per-email log to deleted_emails table (enables history + undo)
"""
import asyncio
import json
from datetime import datetime, timezone

from loguru import logger
from src.accounts.gmail import GmailAccount
from src.classifier.rules_classifier import RulesClassifier
from src.classifier.claude_classifier import ClaudeClassifier
from src.cleaner.email_cleaner import EmailCleaner
from src.utils.models import Email, EmailCategory, ClassificationResult
from src.utils.rate_limiter import RateLimiter

from ..db.supabase import get_supabase
from ..services.encryption import decrypt
from ..config import get_settings

PLAN_LIMITS: dict[str, dict] = {
    "free":     {"max_emails": 100,  "max_accounts": 1,  "allow_claude": False},
    "basic":    {"max_emails": 500,  "max_accounts": 2,  "allow_claude": False},
    "pro":      {"max_emails": 2000, "max_accounts": 5,  "allow_claude": True},
    "business": {"max_emails": 5000, "max_accounts": 20, "allow_claude": True},
}

VALID_CLEANUP_MODES = {"safe", "aggressive", "smart"}

_BATCH_INSERT_SIZE = 500  # Max rows per Supabase insert call


async def run_for_account(
    user_id: str,
    account_id: str,
    run_id: str,
    cleanup_mode: str = "aggressive",
) -> None:
    supabase = get_supabase()
    settings = get_settings()

    if cleanup_mode not in VALID_CLEANUP_MODES:
        cleanup_mode = "aggressive"

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
            raise ValueError(f"Account {account_id} not found for user {user_id}")
        acc = acc_row.data

        if acc["type"] != "gmail":
            raise ValueError(
                "This version only supports Gmail accounts. "
                "Support for additional providers is coming soon."
            )

        # ── 2. Fetch profile + keep rules ─────────────────────────────────────
        profile_row = (
            supabase.table("profiles")
            .select("subscription_plan, free_runs_used, free_runs_limit, old_read_days")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile = profile_row.data or {}
        plan = profile.get("subscription_plan", "free")
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
        max_emails = limits["max_emails"]
        allow_claude = limits["allow_claude"]
        old_read_threshold = profile.get("old_read_days") or 180

        rules_row = (
            supabase.table("keep_rules")
            .select("keyword, match_field")
            .eq("user_id", user_id)
            .execute()
        )
        keep_rules = [(r["keyword"], r["match_field"]) for r in (rules_row.data or [])]

        # ── 3. Build Gmail account ────────────────────────────────────────────
        rate_limiter = RateLimiter(gmail_rps=5, anthropic_rpm=50)
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
            logger.info(f"[{acc['email']}] Gmail authenticated via stored token ✓")

        email_account.authenticate = _patched_auth  # type: ignore

        # ── 4. Run pipeline in thread (keeps async event loop free) ──────────
        def _run_sync() -> dict:
            email_account.authenticate()

            all_fetched: list[Email] = email_account.fetch_emails(max_count=max_emails)
            fetched = len(all_fetched)
            # Build lookup map for subject/sender when writing deleted_emails log
            email_map: dict[str, Email] = {e.id: e for e in all_fetched}

            if not all_fetched:
                email_account.close()
                return {"fetched": 0, "deleted": 0, "kept": 0, "errors": 0, "actioned_records": []}

            emails = all_fetched[:]

            # Step A: Keep rules (user keywords — skip everything else)
            force_kept_count = 0
            if keep_rules:
                emails, force_kept_emails = EmailCleaner._apply_keep_rules(emails, keep_rules)
                force_kept_count = len(force_kept_emails)
                if force_kept_emails:
                    logger.info(
                        f"[{acc['email']}] Keep rules protected "
                        f"{force_kept_count} email(s)"
                    )

            # Step B: OLD_READ pre-classification (deterministic, no AI)
            old_read_results: list[ClassificationResult] = []
            remaining = []
            now = datetime.utcnow()
            for email in emails:
                if not email.date:
                    remaining.append(email)
                    continue
                age_days = (now - email.date.replace(tzinfo=None)).days
                if (
                    email.is_read
                    and age_days >= old_read_threshold
                    and not EmailCleaner._is_payslip(email)
                ):
                    old_read_results.append(
                        ClassificationResult(
                            email_id=email.id,
                            category=EmailCategory.OLD_READ,
                            confidence="high",
                            reasoning=(
                                f"Read email {age_days} days old "
                                f"(threshold: {old_read_threshold} days)"
                            ),
                            action_taken="pending_delete",
                        )
                    )
                else:
                    remaining.append(email)

            logger.info(
                f"[{acc['email']}] OLD_READ: {len(old_read_results)} emails, "
                f"{len(remaining)} remaining for rules engine"
            )

            # Step C: Rules engine (headers, domains, patterns)
            rules_clf = RulesClassifier()
            rules_results, unmatched = rules_clf.classify_batch(
                remaining, old_read_threshold_days=old_read_threshold
            )

            # Step D: Claude Smart Cleanup (Pro + smart mode only)
            ai_results: list[ClassificationResult] = []
            if allow_claude and cleanup_mode == "smart" and unmatched:
                logger.info(
                    f"[{acc['email']}] Smart Cleanup: sending "
                    f"{len(unmatched)} emails to Claude"
                )
                claude_clf = ClaudeClassifier(
                    api_key=settings.anthropic_api_key,
                    rate_limiter=rate_limiter,
                )
                for i in range(0, len(unmatched), 20):
                    batch = unmatched[i : i + 20]
                    ai_results.extend(
                        claude_clf.classify_batch(batch, old_read_threshold)
                    )
            else:
                for email in unmatched:
                    ai_results.append(
                        ClassificationResult(
                            email_id=email.id,
                            category=EmailCategory.KEEP,
                            confidence="medium",
                            reasoning="No rule matched — kept for safety",
                            action_taken="kept",
                        )
                    )

            # ── Step E: Execute cleanup + track per-email actions ─────────────
            all_results = old_read_results + rules_results + ai_results
            actioned = 0
            errors = 0
            kept_count = force_kept_count + sum(
                1 for r in all_results if r.action_taken == "kept"
            )
            actioned_records: list[dict] = []

            if cleanup_mode == "safe":
                # Archive newsletters + social (fully reversible).
                # Trash confirmed spam (30-day recovery window).
                # Leave OLD_READ alone in safe mode.
                for r in all_results:
                    if r.category in (EmailCategory.MARKETING, EmailCategory.SOCIAL):
                        if email_account.archive_email(r.email_id):
                            actioned += 1
                            actioned_records.append({"result": r, "action": "archived"})
                        else:
                            errors += 1
                    elif r.category == EmailCategory.SPAM:
                        if email_account.delete_email(r.email_id):
                            actioned += 1
                            actioned_records.append({"result": r, "action": "trashed"})
                        else:
                            errors += 1
            else:
                # Aggressive / Smart: trash all emails flagged for deletion
                for r in all_results:
                    if r.action_taken == "pending_delete":
                        if email_account.delete_email(r.email_id):
                            actioned += 1
                            actioned_records.append({"result": r, "action": "trashed"})
                        else:
                            errors += 1

            email_account.close()
            logger.info(
                f"[{acc['email']}] Pipeline done — "
                f"fetched={fetched}, actioned={actioned}, "
                f"kept={kept_count}, errors={errors}"
            )
            return {
                "fetched": fetched,
                "deleted": actioned,
                "kept": kept_count,
                "errors": errors,
                "actioned_records": actioned_records,
                "email_map": email_map,
            }

        stats = await asyncio.to_thread(_run_sync)

        # ── 5. Persist aggregate results ──────────────────────────────────────
        supabase.table("cleaning_runs").update({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "emails_fetched": stats["fetched"],
            "emails_deleted": stats["deleted"],
            "emails_kept": stats["kept"],
            "status": "completed",
        }).eq("id", run_id).execute()

        if plan == "free":
            supabase.table("profiles").update({
                "free_runs_used": (profile.get("free_runs_used", 0) or 0) + 1
            }).eq("id", user_id).execute()

        # ── 6. Persist per-email log to deleted_emails ────────────────────────
        actioned_records: list[dict] = stats.get("actioned_records", [])
        email_map: dict[str, Email] = stats.get("email_map", {})

        if actioned_records:
            rows = []
            for rec in actioned_records:
                r: ClassificationResult = rec["result"]
                em: Email | None = email_map.get(r.email_id)
                rows.append({
                    "run_id":     run_id,
                    "user_id":    user_id,
                    "account_id": account_id,
                    "email_id":   r.email_id,
                    "subject":    em.subject if em else None,
                    "sender":     em.sender if em else None,
                    "category":   r.category.value,
                    "confidence": r.confidence,
                    "reasoning":  r.reasoning,
                    "action":     rec["action"],
                })

            # Batch insert in chunks to stay within request size limits
            for i in range(0, len(rows), _BATCH_INSERT_SIZE):
                supabase.table("deleted_emails").insert(rows[i : i + _BATCH_INSERT_SIZE]).execute()

            logger.info(
                f"Run {run_id} — logged {len(rows)} deleted_emails records"
            )

        logger.info(
            f"Run {run_id} completed — "
            f"{stats['deleted']} actioned, {stats['kept']} kept"
        )

    except Exception as exc:
        logger.error(f"Run {run_id} failed: {exc}", exc_info=True)
        supabase.table("cleaning_runs").update({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "status": "failed",
            "error_message": str(exc),
        }).eq("id", run_id).execute()
        raise

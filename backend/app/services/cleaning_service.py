"""
Cleaning service — orchestrates a full email clean for one user+account.
Imports the existing Email-Automation core code via sys.path.
"""
import asyncio
import json
from datetime import datetime, timezone

from loguru import logger
from src.accounts.gmail import GmailAccount
from src.accounts.imap import ImapAccount
from src.utils.rate_limiter import RateLimiter
from src.classifier.claude_classifier import ClaudeClassifier
from src.cleaner.email_cleaner import EmailCleaner
from src.utils.models import EmailCategory
# ──────────────────────────────────────────────────────────────────────────

from ..db.supabase import get_supabase
from ..services.encryption import decrypt
from ..config import get_settings

PLAN_LIMITS: dict[str, dict] = {
    "free":  {"max_emails": 100,   "max_accounts": 1},
    "basic": {"max_emails": 500,   "max_accounts": 2},
    "pro":   {"max_emails": 2000,  "max_accounts": 5},
}


async def run_for_account(user_id: str, account_id: str, run_id: str) -> None:
    supabase = get_supabase()
    settings = get_settings()

    try:
        # 1. Fetch account
        acc_row = supabase.table("email_accounts").select("*").eq("id", account_id).eq("user_id", user_id).single().execute()
        if not acc_row.data:
            raise ValueError(f"Account {account_id} not found for user {user_id}")
        acc = acc_row.data

        # 2. Fetch profile + keep rules in parallel
        profile_row = supabase.table("profiles").select("subscription_plan, free_runs_used, free_runs_limit").eq("id", user_id).single().execute()
        profile = profile_row.data or {}
        plan = profile.get("subscription_plan", "free")
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
        max_emails = limits["max_emails"] or 500

        rules_row = supabase.table("keep_rules").select("keyword, match_field").eq("user_id", user_id).execute()
        keep_rules = [(r["keyword"], r["match_field"]) for r in (rules_row.data or [])]

        # 3. Build account object — higher IMAP rate for speed (20 req/s ≈ 500 emails in ~25s)
        rate_limiter = RateLimiter(gmail_rps=20, anthropic_rpm=50)
        decrypted = decrypt(acc["encrypted_token"])

        if acc["type"] == "gmail":
            import google.oauth2.credentials
            token_data = json.loads(decrypted)
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
            # Monkey-patch to use pre-built credentials
            email_account._creds = creds  # type: ignore
            _original_auth = email_account.authenticate

            def _patched_auth():
                from googleapiclient.discovery import build
                email_account._service = build("gmail", "v1", credentials=creds)
                logger.info(f"[{acc['email']}] Gmail authenticated via stored token ✓")

            email_account.authenticate = _patched_auth  # type: ignore
        else:
            email_account = ImapAccount(
                account_name=acc["email"],
                email_address=acc["email"],
                app_password=decrypted,
                rate_limiter=rate_limiter,
                imap_host=acc.get("imap_host", ""),
                imap_port=acc.get("imap_port", 993),
            )

        # 4. Build a minimal config-like object for EmailCleaner
        class _FakeCfg:
            anthropic_api_key = settings.anthropic_api_key
            yahoo_app_password = ""
            class global_:
                dry_run = False
                batch_size = 20
                max_emails_per_run = max_emails
                old_read_days = 30
                schedule_interval_hours = 6
            class rate_limits:
                gmail_requests_per_second = 5
                anthropic_requests_per_minute = 50
            accounts = []

        class _FakeAccountCfg:
            name = acc["email"]
            type = acc["type"]
            email = acc["email"]
            enabled = True
            old_read_days = 30
            token_file = None
            credentials_file = None
            imap_host = acc.get("imap_host", "")
            imap_port = acc.get("imap_port", 993)
            app_password = None
            user_keep_rules = keep_rules  # list of (keyword, match_field)

        fake_cfg = _FakeCfg()
        fake_acc_cfg = _FakeAccountCfg()

        # 5. Run the cleaner — in a thread so the async event loop stays free for polling
        from src.utils.models import RunStats

        def _run_sync():
            stats_obj = RunStats(account=acc["email"])
            cleaner = EmailCleaner(fake_cfg, dry_run=False)  # type: ignore
            cleaner._process_account(email_account, fake_acc_cfg, stats_obj)
            email_account.close()
            return stats_obj

        stats = await asyncio.to_thread(_run_sync)

        # 6. We can't easily intercept per-email results from _process_account
        # so we just record the aggregate stats. For detailed per-email records,
        # a future refactor of EmailCleaner to return results would help.
        # For now, update the run row with totals.
        supabase.table("cleaning_runs").update({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "emails_fetched": stats.fetched,
            "emails_deleted": stats.deleted,
            "emails_kept": stats.kept,
            "status": "completed",
        }).eq("id", run_id).execute()

        # 7. Increment free_runs_used if on free plan
        if plan == "free":
            supabase.table("profiles").update({
                "free_runs_used": (profile.get("free_runs_used", 0) or 0) + 1
            }).eq("id", user_id).execute()

        logger.info(f"Run {run_id} completed — {stats.deleted} deleted, {stats.kept} kept")

    except Exception as exc:
        logger.error(f"Run {run_id} failed: {exc}", exc_info=True)
        supabase.table("cleaning_runs").update({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "status": "failed",
            "error_message": str(exc),
        }).eq("id", run_id).execute()
        raise

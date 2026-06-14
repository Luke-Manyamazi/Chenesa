import asyncio
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..dependencies import get_current_user
from ..db.supabase import get_supabase
from ..services.cleaning_service import run_for_account
from ..services.encryption import decrypt
from ..models.requests import TriggerRunRequest
from ..models.responses import RunOut, RunDetailOut

router = APIRouter()

PLAN_FREE_RUN_LIMIT = 3
CLAUDE_PLANS = {"pro", "business"}


@router.post("")
async def trigger_run(
    body: TriggerRunRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    supabase = get_supabase()

    cleanup_mode = body.cleanup_mode if body.cleanup_mode in ("safe", "aggressive", "smart") else "aggressive"

    # Verify account ownership
    acc = (
        supabase.table("email_accounts")
        .select("id, email, type")
        .eq("id", body.account_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not acc.data:
        raise HTTPException(status_code=404, detail="Account not found")

    # Gmail-only in this version
    if acc.data.get("type") != "gmail":
        raise HTTPException(
            status_code=400,
            detail="Only Gmail accounts are supported in this version. More providers coming soon.",
        )

    # Fetch profile for plan checks
    profile = (
        supabase.table("profiles")
        .select("subscription_plan, free_runs_used, free_runs_limit")
        .eq("id", user_id)
        .single()
        .execute()
    )
    p = profile.data or {}
    plan = p.get("subscription_plan", "free")

    # Smart Cleanup requires Pro or Business plan
    if cleanup_mode == "smart" and plan not in CLAUDE_PLANS:
        raise HTTPException(
            status_code=403,
            detail="Smart Cleanup requires a Pro plan. Upgrade to unlock AI-powered analysis.",
        )

    # Free plan run limit check
    if plan == "free":
        used = p.get("free_runs_used", 0) or 0
        limit = p.get("free_runs_limit", PLAN_FREE_RUN_LIMIT) or PLAN_FREE_RUN_LIMIT
        if used >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"You've used all {limit} free cleans. Upgrade to continue.",
            )

    # Create run record
    run_id = str(uuid.uuid4())
    supabase.table("cleaning_runs").insert({
        "id": run_id,
        "user_id": user_id,
        "account_id": body.account_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "emails_fetched": 0,
        "emails_deleted": 0,
        "emails_kept": 0,
        "cleanup_mode": cleanup_mode,
    }).execute()

    background_tasks.add_task(run_for_account, user_id, body.account_id, run_id, cleanup_mode)

    return {"run_id": run_id, "status": "running"}


@router.get("", response_model=list[RunOut])
async def list_runs(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    rows = (
        supabase.table("cleaning_runs")
        .select("*, email_accounts(email)")
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(50)
        .execute()
    )
    result = []
    for r in (rows.data or []):
        result.append(RunOut(
            id=r["id"],
            account_id=r["account_id"],
            account_email=(r.get("email_accounts") or {}).get("email"),
            started_at=r["started_at"],
            completed_at=r.get("completed_at"),
            emails_fetched=r.get("emails_fetched", 0),
            emails_deleted=r.get("emails_deleted", 0),
            emails_kept=r.get("emails_kept", 0),
            status=r["status"],
            error_message=r.get("error_message"),
        ))
    return result


@router.get("/{run_id}", response_model=RunDetailOut)
async def get_run(run_id: str, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    run = (
        supabase.table("cleaning_runs")
        .select("*, email_accounts(email)")
        .eq("id", run_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not run.data:
        raise HTTPException(status_code=404, detail="Run not found")
    r = run.data
    emails = (
        supabase.table("deleted_emails")
        .select("subject, sender, category, reasoning")
        .eq("run_id", run_id)
        .execute()
    )
    return RunDetailOut(
        id=r["id"],
        account_id=r["account_id"],
        account_email=(r.get("email_accounts") or {}).get("email"),
        started_at=r["started_at"],
        completed_at=r.get("completed_at"),
        emails_fetched=r.get("emails_fetched", 0),
        emails_deleted=r.get("emails_deleted", 0),
        emails_kept=r.get("emails_kept", 0),
        status=r["status"],
        error_message=r.get("error_message"),
        deleted_emails=emails.data or [],
    )


@router.post("/{run_id}/undo")
async def undo_run(run_id: str, user_id: str = Depends(get_current_user)):
    """Restore emails from a completed run back to inbox / un-archive them."""
    supabase = get_supabase()

    run = (
        supabase.table("cleaning_runs")
        .select("*, email_accounts(*)")
        .eq("id", run_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not run.data:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Only completed runs can be undone")

    items = (
        supabase.table("deleted_emails")
        .select("email_id, action")
        .eq("run_id", run_id)
        .execute()
    )
    if not (items.data):
        raise HTTPException(status_code=400, detail="No email log found for this run — cannot undo")

    # Rebuild Gmail credentials
    acc = run.data["email_accounts"]
    decrypted = decrypt(acc["encrypted_token"])
    token_data = json.loads(decrypted)

    import google.oauth2.credentials
    from googleapiclient.discovery import build
    from src.utils.rate_limiter import RateLimiter
    from src.accounts.gmail import GmailAccount

    creds = google.oauth2.credentials.Credentials(
        token=token_data["token"],
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
    )
    rate_limiter = RateLimiter(gmail_rps=10, anthropic_rpm=1)
    email_account = GmailAccount(
        account_name=acc["email"],
        email_address=acc["email"],
        token_file="",
        credentials_file="",
        rate_limiter=rate_limiter,
    )

    def _patched_auth():
        email_account._service = build("gmail", "v1", credentials=creds)

    email_account.authenticate = _patched_auth  # type: ignore

    snapshot = items.data  # capture for thread

    def _do_undo() -> dict:
        email_account.authenticate()
        restored = 0
        errors = 0
        for item in snapshot:
            if item["action"] == "trashed":
                if email_account.untrash_email(item["email_id"]):
                    restored += 1
                else:
                    errors += 1
            elif item["action"] == "archived":
                if email_account.restore_to_inbox(item["email_id"]):
                    restored += 1
                else:
                    errors += 1
        email_account.close()
        return {"restored": restored, "errors": errors}

    result = await asyncio.to_thread(_do_undo)
    return result

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..dependencies import get_current_user
from ..db.supabase import get_supabase
from ..services.cleaning_service import run_for_account
from ..models.requests import TriggerRunRequest
from ..models.responses import RunOut, RunDetailOut

router = APIRouter()

PLAN_FREE_RUN_LIMIT = 3


@router.post("")
async def trigger_run(
    body: TriggerRunRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    supabase = get_supabase()

    # Verify account ownership
    acc = supabase.table("email_accounts").select("id, email").eq("id", body.account_id).eq("user_id", user_id).single().execute()
    if not acc.data:
        raise HTTPException(status_code=404, detail="Account not found")

    # Check free plan run limit
    profile = supabase.table("profiles").select("subscription_plan, free_runs_used, free_runs_limit").eq("id", user_id).single().execute()
    p = profile.data or {}
    plan = p.get("subscription_plan", "free")
    if plan == "free":
        used = p.get("free_runs_used", 0) or 0
        limit = p.get("free_runs_limit", PLAN_FREE_RUN_LIMIT) or PLAN_FREE_RUN_LIMIT
        if used >= limit:
            raise HTTPException(status_code=403, detail=f"You've used all {limit} free cleans. Upgrade to continue.")

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
    }).execute()

    # Fire background task
    background_tasks.add_task(run_for_account, user_id, body.account_id, run_id)

    return {"run_id": run_id, "status": "running"}


@router.get("", response_model=list[RunOut])
async def list_runs(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    rows = supabase.table("cleaning_runs").select("*, email_accounts(email)").eq("user_id", user_id).order("started_at", desc=True).limit(50).execute()
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
    run = supabase.table("cleaning_runs").select("*, email_accounts(email)").eq("id", run_id).eq("user_id", user_id).single().execute()
    if not run.data:
        raise HTTPException(status_code=404, detail="Run not found")
    r = run.data
    emails = supabase.table("deleted_emails").select("subject, sender, category, reasoning").eq("run_id", run_id).execute()
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

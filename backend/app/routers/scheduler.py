import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from ..config import get_settings
from ..db.supabase import get_supabase
from ..services.cleaning_service import run_for_account

router = APIRouter()


@router.post("/trigger")
async def trigger_scheduled_runs(
    background_tasks: BackgroundTasks,
    x_scheduler_secret: str = Header(...),
):
    if x_scheduler_secret != get_settings().scheduler_secret:
        raise HTTPException(status_code=403, detail="Invalid scheduler secret")

    supabase = get_supabase()
    six_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    triggered = 0

    # Get all enabled accounts
    accounts = supabase.table("email_accounts").select("id, user_id, email").eq("enabled", True).execute()

    for acc in (accounts.data or []):
        # Check last run
        last_run = supabase.table("cleaning_runs").select("started_at").eq("account_id", acc["id"]).order("started_at", desc=True).limit(1).execute()
        if last_run.data:
            last_time = last_run.data[0]["started_at"]
            if last_time > six_hours_ago:
                continue  # Ran recently — skip

        # Check free plan run limit
        profile = supabase.table("profiles").select("subscription_plan, free_runs_used, free_runs_limit").eq("id", acc["user_id"]).single().execute()
        p = profile.data or {}
        plan = p.get("subscription_plan", "free")
        if plan == "free":
            used = p.get("free_runs_used", 0) or 0
            limit = p.get("free_runs_limit", 3) or 3
            if used >= limit:
                continue  # Free trial exhausted

        # Create run
        run_id = str(uuid.uuid4())
        supabase.table("cleaning_runs").insert({
            "id": run_id,
            "user_id": acc["user_id"],
            "account_id": acc["id"],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": "running",
            "emails_fetched": 0,
            "emails_deleted": 0,
            "emails_kept": 0,
        }).execute()

        background_tasks.add_task(run_for_account, acc["user_id"], acc["id"], run_id)
        triggered += 1

    return {"triggered": triggered, "message": f"Started {triggered} cleaning run(s)"}

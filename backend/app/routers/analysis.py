from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ..auth import get_current_user
from ..db.supabase import get_supabase
from ..services.analysis_service import run_analysis

router = APIRouter()


@router.post("/trigger")
async def trigger_analysis(
    payload: dict,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    """
    Start an inbox storage analysis for the given Gmail account.
    Returns immediately; analysis runs in the background.
    """
    account_id = payload.get("account_id")
    if not account_id:
        raise HTTPException(status_code=422, detail="account_id is required")

    supabase = get_supabase()
    user_id = user["id"]

    # Verify the account belongs to this user and is gmail
    acc = (
        supabase.table("email_accounts")
        .select("id, type")
        .eq("id", account_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not acc.data:
        raise HTTPException(status_code=404, detail="Account not found")
    if acc.data["type"] != "gmail":
        raise HTTPException(status_code=400, detail="Only Gmail accounts can be analysed")

    # Cancel any in-progress analysis for this account
    supabase.table("inbox_analyses").update(
        {"status": "failed", "error_message": "Superseded by new analysis request"}
    ).eq("account_id", account_id).eq("status", "running").execute()

    # Create a new analysis record
    analysis_id = str(uuid4())
    supabase.table("inbox_analyses").insert({
        "id": analysis_id,
        "user_id": user_id,
        "account_id": account_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    background_tasks.add_task(run_analysis, user_id, account_id, analysis_id)

    return {"analysis_id": analysis_id, "status": "running"}


@router.get("/latest")
async def get_latest_analysis(
    account_id: str,
    user=Depends(get_current_user),
):
    """Return the most recent analysis result for the given account."""
    supabase = get_supabase()
    user_id = user["id"]

    result = (
        supabase.table("inbox_analyses")
        .select("*")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    rows = result.data or []
    if not rows:
        return {"status": "none"}

    return rows[0]

"""
Admin-only endpoints. All routes require is_admin = TRUE in the caller's profile.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..dependencies import get_admin_user
from ..db.supabase import get_supabase

router = APIRouter()

VALID_PLANS = {"free", "basic", "pro", "business"}


# ── Overview stats ────────────────────────────────────────────────────────────

@router.get("/overview")
async def admin_overview(_: str = Depends(get_admin_user)):
    """Platform-wide aggregate stats."""
    supabase = get_supabase()

    users_res    = supabase.table("profiles").select("id", count="exact").execute()
    runs_res     = supabase.table("cleaning_runs").select("emails_deleted", count="exact").execute()
    accounts_res = supabase.table("email_accounts").select("id", count="exact").execute()
    waitlist_res = supabase.table("waitlist").select("id", count="exact").execute()
    analyses_res = supabase.table("inbox_analyses").select("recoverable_size_bytes").eq("status", "completed").execute()

    total_deleted = sum((r.get("emails_deleted") or 0) for r in (runs_res.data or []))
    total_recoverable = sum((r.get("recoverable_size_bytes") or 0) for r in (analyses_res.data or []))

    # Plan breakdown
    plan_res = supabase.table("profiles").select("subscription_plan").execute()
    plan_counts: dict[str, int] = {}
    for row in (plan_res.data or []):
        p = row.get("subscription_plan", "free")
        plan_counts[p] = plan_counts.get(p, 0) + 1

    return {
        "total_users":       users_res.count    or 0,
        "total_runs":        runs_res.count      or 0,
        "total_accounts":    accounts_res.count  or 0,
        "total_waitlist":    waitlist_res.count  or 0,
        "total_emails_deleted":    total_deleted,
        "total_recoverable_bytes": total_recoverable,
        "plan_breakdown":    plan_counts,
    }


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def admin_users(_: str = Depends(get_admin_user)):
    """All users with their plan, usage, and last run date."""
    supabase = get_supabase()

    profiles = supabase.table("profiles") \
        .select("id, email, subscription_plan, free_runs_used, free_runs_limit, is_admin, created_at") \
        .order("created_at", desc=True) \
        .execute()

    # Get last run per user in one query
    runs = supabase.table("cleaning_runs") \
        .select("user_id, started_at, emails_deleted, status") \
        .order("started_at", desc=True) \
        .execute()

    last_run_map: dict[str, dict] = {}
    run_count_map: dict[str, int] = {}
    for r in (runs.data or []):
        uid = r["user_id"]
        run_count_map[uid] = run_count_map.get(uid, 0) + 1
        if uid not in last_run_map:
            last_run_map[uid] = r

    result = []
    for p in (profiles.data or []):
        uid = p["id"]
        result.append({
            **p,
            "total_runs":    run_count_map.get(uid, 0),
            "last_run_at":   last_run_map.get(uid, {}).get("started_at"),
            "last_run_status": last_run_map.get(uid, {}).get("status"),
        })

    return result


# ── Change plan ───────────────────────────────────────────────────────────────

class PlanUpdate(BaseModel):
    plan: str


@router.patch("/users/{user_id}/plan")
async def set_user_plan(
    user_id: str,
    body: PlanUpdate,
    _: str = Depends(get_admin_user),
):
    if body.plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {sorted(VALID_PLANS)}")

    supabase = get_supabase()
    supabase.table("profiles") \
        .update({"subscription_plan": body.plan}) \
        .eq("id", user_id) \
        .execute()

    return {"user_id": user_id, "plan": body.plan}


# ── Waitlist ──────────────────────────────────────────────────────────────────

@router.get("/waitlist")
async def admin_waitlist(_: str = Depends(get_admin_user)):
    supabase = get_supabase()
    rows = supabase.table("waitlist") \
        .select("email, source, created_at") \
        .order("created_at", desc=True) \
        .execute()
    return rows.data or []


# ── Recent runs (cross-user) ──────────────────────────────────────────────────

@router.get("/runs")
async def admin_runs(_: str = Depends(get_admin_user)):
    supabase = get_supabase()
    rows = supabase.table("cleaning_runs") \
        .select("*, email_accounts(email), profiles(email)") \
        .order("started_at", desc=True) \
        .limit(100) \
        .execute()
    return rows.data or []

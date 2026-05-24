from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..dependencies import get_current_user
from ..db.supabase import get_supabase

router = APIRouter()

VALID_OLD_READ_DAYS = {30, 90, 180, 365}


class KeepRuleIn(BaseModel):
    keyword:     str  = Field(..., min_length=1, max_length=200)
    match_field: str  = Field("all", pattern="^(subject|sender|all)$")


class ProfilePrefsIn(BaseModel):
    old_read_days: int = Field(..., ge=30, le=365)


@router.get("/profile")
async def get_profile_prefs(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    row = supabase.table("profiles").select("old_read_days") \
        .eq("id", user_id).single().execute()
    return {"old_read_days": (row.data or {}).get("old_read_days", 180)}


@router.patch("/profile")
async def update_profile_prefs(body: ProfilePrefsIn, user_id: str = Depends(get_current_user)):
    if body.old_read_days not in VALID_OLD_READ_DAYS:
        raise HTTPException(status_code=400, detail=f"old_read_days must be one of {sorted(VALID_OLD_READ_DAYS)}")
    supabase = get_supabase()
    supabase.table("profiles").update({"old_read_days": body.old_read_days}) \
        .eq("id", user_id).execute()
    return {"old_read_days": body.old_read_days}


@router.get("/keep-rules")
async def list_keep_rules(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    rows = supabase.table("keep_rules").select("*") \
        .eq("user_id", user_id).order("created_at").execute()
    return rows.data or []


@router.post("/keep-rules", status_code=201)
async def add_keep_rule(body: KeepRuleIn, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    # Limit to 50 rules per user
    count = supabase.table("keep_rules").select("id", count="exact") \
        .eq("user_id", user_id).execute()
    if (count.count or 0) >= 50:
        raise HTTPException(status_code=400, detail="Maximum 50 keep rules allowed")
    try:
        row = supabase.table("keep_rules").insert({
            "user_id":     user_id,
            "keyword":     body.keyword.strip(),
            "match_field": body.match_field,
        }).execute()
        return row.data[0]
    except Exception:
        raise HTTPException(status_code=409, detail="Rule already exists")


@router.delete("/keep-rules/{rule_id}", status_code=204)
async def delete_keep_rule(rule_id: str, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("keep_rules").delete() \
        .eq("id", rule_id).eq("user_id", user_id).execute()

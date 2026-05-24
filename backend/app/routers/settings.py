from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..dependencies import get_current_user
from ..db.supabase import get_supabase

router = APIRouter()


class KeepRuleIn(BaseModel):
    keyword:     str  = Field(..., min_length=1, max_length=200)
    match_field: str  = Field("all", pattern="^(subject|sender|all)$")


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

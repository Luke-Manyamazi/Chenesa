import os
import sys
from fastapi import APIRouter, Depends, HTTPException
from ..dependencies import get_current_user
from ..db.supabase import get_supabase
from ..services.encryption import encrypt
from ..models.requests import ConnectImapRequest, ToggleAccountRequest
from ..models.responses import AccountOut

# Import provider auto-detection from email-automation core
_EMAIL_AUTO_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "Email-Automation")
)
if _EMAIL_AUTO_DIR not in sys.path:
    sys.path.insert(0, _EMAIL_AUTO_DIR)
from src.accounts.imap import detect_imap_settings  # noqa: E402

router = APIRouter()


@router.get("", response_model=list[AccountOut])
async def list_accounts(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    rows = supabase.table("email_accounts").select("id, email, type, enabled, imap_host, imap_port, created_at").eq("user_id", user_id).order("created_at").execute()
    return rows.data or []


@router.post("/imap", response_model=AccountOut)
async def connect_imap(body: ConnectImapRequest, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()

    # Check account limit based on plan
    profile = supabase.table("profiles").select("subscription_plan").eq("id", user_id).single().execute()
    plan = (profile.data or {}).get("subscription_plan", "free")
    limits = {"free": 1, "basic": 2, "pro": 4}
    max_acc = limits.get(plan, 1)
    current = supabase.table("email_accounts").select("id", count="exact").eq("user_id", user_id).execute()
    if (current.count or 0) >= max_acc:
        raise HTTPException(status_code=403, detail=f"Your {plan} plan allows up to {max_acc} account(s). Upgrade to add more.")

    # Auto-detect IMAP host if not provided
    imap_host = body.imap_host or ""
    imap_port = body.imap_port or 993
    if not imap_host:
        detected_host, detected_port = detect_imap_settings(body.email)
        imap_host = detected_host
        if not body.imap_host:
            imap_port = detected_port

    if not imap_host:
        raise HTTPException(status_code=400, detail=f"Cannot auto-detect IMAP server for {body.email}. Please provide imap_host manually.")

    encrypted = encrypt(body.app_password)
    row = supabase.table("email_accounts").insert({
        "user_id": user_id,
        "type": "imap",
        "email": body.email,
        "encrypted_token": encrypted,
        "imap_host": imap_host,
        "imap_port": imap_port,
        "enabled": True,
    }).execute()

    return row.data[0]


@router.patch("/{account_id}")
async def toggle_account(account_id: str, body: ToggleAccountRequest, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("email_accounts").update({"enabled": body.enabled}).eq("id", account_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.delete("/{account_id}")
async def delete_account(account_id: str, user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("email_accounts").delete().eq("id", account_id).eq("user_id", user_id).execute()
    return {"ok": True}

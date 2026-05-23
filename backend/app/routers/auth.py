import json
from fastapi import APIRouter, Depends, Query
from googleapiclient.discovery import build
from ..services.gmail_oauth import get_auth_url, exchange_code
from ..services.encryption import encrypt
from ..db.supabase import get_supabase
from ..dependencies import get_current_user

router = APIRouter()


@router.get("/gmail/url")
async def gmail_auth_url(user_id: str = Depends(get_current_user)):
    url = get_auth_url(state=user_id)
    return {"url": url}


@router.get("/gmail/callback")
async def gmail_callback(code: str = Query(...), state: str = Query(...)):
    """state = user_id. Called by Google after OAuth consent."""
    user_id = state
    token_data = exchange_code(code)

    # Get Gmail email address
    import google.oauth2.credentials
    creds = google.oauth2.credentials.Credentials(
        token=token_data["token"],
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
    )
    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    email_address = profile["emailAddress"]

    encrypted = encrypt(json.dumps(token_data))
    supabase = get_supabase()

    # Upsert account (re-connecting same Gmail replaces it)
    existing = supabase.table("email_accounts").select("id").eq("user_id", user_id).eq("email", email_address).execute()
    if existing.data:
        supabase.table("email_accounts").update({"encrypted_token": encrypted}).eq("id", existing.data[0]["id"]).execute()
    else:
        supabase.table("email_accounts").insert({
            "user_id": user_id,
            "type": "gmail",
            "email": email_address,
            "encrypted_token": encrypted,
            "enabled": True,
        }).execute()

    return {"message": f"Gmail account {email_address} connected successfully"}

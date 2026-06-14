"""
Billing endpoints — PayFast subscription checkout, ITN webhook, cancel.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ..dependencies import get_current_user
from ..db.supabase import get_supabase
from ..config import get_settings
from ..services.payfast import build_checkout, validate_itn, cancel_subscription, PLAN_AMOUNTS

router = APIRouter()

PAID_PLANS = set(PLAN_AMOUNTS.keys())


def _backend_url(s) -> str:
    """Derive Railway backend URL from GOOGLE_REDIRECT_URI env var."""
    if s.google_redirect_uri:
        return s.google_redirect_uri.replace("/auth/gmail/callback", "")
    return "http://localhost:8000"


# ── Checkout ──────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str  # 'pro' or 'business'


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    user_id: str = Depends(get_current_user),
):
    if body.plan not in PAID_PLANS:
        raise HTTPException(400, detail=f"Invalid plan. Must be one of: {sorted(PAID_PLANS)}")

    s        = get_settings()
    supabase = get_supabase()

    profile = supabase.table("profiles").select("email, subscription_plan").eq("id", user_id).single().execute()
    p       = profile.data or {}
    email   = p.get("email", "")

    # Don't let user re-subscribe to the same active plan
    if p.get("subscription_plan") == body.plan:
        raise HTTPException(400, detail="You are already on this plan")

    return build_checkout(
        user_id=user_id,
        email=email,
        plan=body.plan,
        frontend_url=s.frontend_url,
        backend_url=_backend_url(s),
        merchant_id=s.payfast_merchant_id,
        merchant_key=s.payfast_merchant_key,
        passphrase=s.payfast_passphrase,
        sandbox=s.payfast_sandbox,
    )


# ── ITN (Instant Transaction Notification) ────────────────────────────────────

@router.post("/itn")
async def payfast_itn(request: Request):
    """
    PayFast posts payment confirmations here — no user auth.
    Must always return 200 or PayFast will retry.
    """
    s         = get_settings()
    form      = await request.form()
    post_data = dict(form)

    # Validate signature + server ping
    valid = await validate_itn(post_data, passphrase=s.payfast_passphrase, sandbox=s.payfast_sandbox)
    if not valid:
        return JSONResponse({"status": "invalid"}, status_code=200)

    payment_status = post_data.get("payment_status", "")
    m_payment_id   = post_data.get("m_payment_id", "")
    token          = post_data.get("token") or None

    if ":" not in m_payment_id:
        return JSONResponse({"status": "bad_id"}, status_code=200)

    user_id, plan = m_payment_id.split(":", 1)
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    if payment_status == "COMPLETE":
        supabase.table("profiles").update({
            "subscription_plan":  plan,
            "payfast_token":      token,
            "subscription_start": now,
            "subscription_end":   None,
        }).eq("id", user_id).execute()

    elif payment_status in ("CANCELLED", "FAILED"):
        supabase.table("profiles").update({
            "subscription_plan": "free",
            "payfast_token":     None,
            "subscription_end":  now,
        }).eq("id", user_id).execute()

    return JSONResponse({"status": "ok"}, status_code=200)


# ── Subscription status ───────────────────────────────────────────────────────

@router.get("/subscription")
async def get_subscription(user_id: str = Depends(get_current_user)):
    supabase = get_supabase()
    row = supabase.table("profiles").select(
        "subscription_plan, payfast_token, subscription_start, subscription_end"
    ).eq("id", user_id).single().execute()
    return row.data or {}


# ── Cancel ────────────────────────────────────────────────────────────────────

@router.post("/cancel")
async def cancel_user_subscription(user_id: str = Depends(get_current_user)):
    s        = get_settings()
    supabase = get_supabase()

    row   = supabase.table("profiles").select("payfast_token, subscription_plan").eq("id", user_id).single().execute()
    data  = row.data or {}
    token = data.get("payfast_token")

    if not token:
        raise HTTPException(400, detail="No active subscription found")

    ok = await cancel_subscription(
        token=token,
        merchant_id=s.payfast_merchant_id,
        passphrase=s.payfast_passphrase,
        sandbox=s.payfast_sandbox,
    )
    if not ok:
        raise HTTPException(502, detail="PayFast cancellation request failed")

    supabase.table("profiles").update({
        "subscription_plan": "free",
        "payfast_token":     None,
        "subscription_end":  datetime.now(timezone.utc).isoformat(),
    }).eq("id", user_id).execute()

    return {"status": "cancelled"}

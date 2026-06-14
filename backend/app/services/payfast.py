"""
PayFast payment gateway utilities.
Docs: https://developers.payfast.co.za/docs
"""
import hashlib
import urllib.parse
from collections import OrderedDict

PAYFAST_PROCESS_URL         = "https://www.payfast.co.za/eng/process"
PAYFAST_SANDBOX_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process"
PAYFAST_VALIDATE_URL        = "https://www.payfast.co.za/eng/query/validate"
PAYFAST_SANDBOX_VALIDATE_URL= "https://sandbox.payfast.co.za/eng/query/validate"
PAYFAST_API_BASE            = "https://api.payfast.co.za"

PLAN_AMOUNTS: dict[str, str] = {
    "pro":      "99.00",
    "business": "299.00",
}


# ── Signature ─────────────────────────────────────────────────────────────────

def generate_signature(data: dict, passphrase: str = "") -> str:
    """MD5 signature over ordered key=urlencode(value) pairs."""
    parts = []
    for key, val in data.items():
        if val is not None and str(val).strip() != "":
            parts.append(f"{key}={urllib.parse.quote_plus(str(val).strip())}")
    param_string = "&".join(parts)
    if passphrase:
        param_string += f"&passphrase={urllib.parse.quote_plus(passphrase.strip())}"
    return hashlib.md5(param_string.encode()).hexdigest()


# ── Checkout ──────────────────────────────────────────────────────────────────

def build_checkout(
    user_id:      str,
    email:        str,
    plan:         str,
    frontend_url: str,
    backend_url:  str,
    merchant_id:  str,
    merchant_key: str,
    passphrase:   str = "",
    sandbox:      bool = True,
) -> dict:
    """Return PayFast form action + fields for a subscription checkout."""
    amount       = PLAN_AMOUNTS[plan]
    item_name    = f"Chenesa {plan.title()} Plan"
    m_payment_id = f"{user_id}:{plan}"

    fields = OrderedDict([
        ("merchant_id",       merchant_id),
        ("merchant_key",      merchant_key),
        ("return_url",        f"{frontend_url}/billing/success"),
        ("cancel_url",        f"{frontend_url}/billing/cancel"),
        ("notify_url",        f"{backend_url}/billing/itn"),
        ("email_address",     email),
        ("m_payment_id",      m_payment_id),
        ("amount",            amount),
        ("item_name",         item_name),
        ("subscription_type", "1"),
        ("recurring_amount",  amount),
        ("frequency",         "3"),
        ("cycles",            "0"),
    ])

    fields["signature"] = generate_signature(dict(fields), passphrase)

    return {
        "action": PAYFAST_SANDBOX_PROCESS_URL if sandbox else PAYFAST_PROCESS_URL,
        "fields": dict(fields),
    }


# ── ITN validation ────────────────────────────────────────────────────────────

async def validate_itn(post_data: dict, passphrase: str = "", sandbox: bool = True) -> bool:
    """Validate PayFast ITN: check signature, then ping PayFast validate endpoint."""
    import httpx

    # 1. Signature check
    data_no_sig = {k: v for k, v in post_data.items() if k != "signature"}
    expected = generate_signature(data_no_sig, passphrase)
    if post_data.get("signature") != expected:
        return False

    # 2. Server-side validation ping
    validate_url = PAYFAST_SANDBOX_VALIDATE_URL if sandbox else PAYFAST_VALIDATE_URL
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                validate_url,
                data=data_no_sig,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        return resp.text.strip() == "VALID"
    except Exception:
        return False


# ── Subscription API ──────────────────────────────────────────────────────────

def _api_signature_headers(merchant_id: str, passphrase: str = "") -> dict:
    from datetime import datetime, timezone
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    header_data = OrderedDict([
        ("merchant-id", merchant_id),
        ("version",     "v1"),
        ("timestamp",   ts),
    ])
    sig = generate_signature(dict(header_data), passphrase)
    return {"merchant-id": merchant_id, "version": "v1", "timestamp": ts, "signature": sig}


async def cancel_subscription(
    token:       str,
    merchant_id: str,
    passphrase:  str = "",
    sandbox:     bool = True,
) -> bool:
    """Cancel a PayFast recurring subscription by token."""
    import httpx
    url = f"{PAYFAST_API_BASE}/subscriptions/{token}/cancel"
    params = {"testing": "true"} if sandbox else {}
    headers = _api_signature_headers(merchant_id, passphrase)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.put(url, headers=headers, params=params)
        return resp.status_code in (200, 204)
    except Exception:
        return False

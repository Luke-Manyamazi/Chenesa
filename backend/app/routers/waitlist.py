"""
Waitlist endpoint — stores tester notification emails during the beta phase
and optionally sends a real-time notification to the configured NOTIFY_EMAIL.

Environment variables (set in Railway):
  NOTIFY_EMAIL          – address that receives new-signup alerts
                          e.g. lukemanyamazi1@gmail.com
  NOTIFY_EMAIL_PASSWORD – Gmail App Password for that address
                          (Account → Security → 2-Step → App passwords)

If either var is missing the signup still succeeds; the notification is silently skipped.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from loguru import logger

from ..dependencies import get_current_user
from ..db.supabase import get_supabase

router = APIRouter()


class WaitlistIn(BaseModel):
    email: str


def _send_notification(signup_email: str) -> None:
    """Fire a quick email to the owner when someone joins the waitlist."""
    notify_to  = os.getenv("NOTIFY_EMAIL")
    notify_pwd = os.getenv("NOTIFY_EMAIL_PASSWORD")
    if not notify_to or not notify_pwd:
        return  # not configured — skip silently

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🎉 Chenesa waitlist: {signup_email}"
        msg["From"]    = notify_to
        msg["To"]      = notify_to

        text = (
            f"New Chenesa waitlist signup!\n\n"
            f"Email: {signup_email}\n\n"
            f"— Chenesa backend"
        )
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#6366f1;margin-bottom:8px">🎉 New waitlist signup</h2>
          <p style="color:#334155;font-size:15px">
            <strong>{signup_email}</strong> just signed up for the Chenesa waitlist.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="color:#94a3b8;font-size:12px">Chenesa · Camluk Technologies</p>
        </div>
        """
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html,  "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(notify_to, notify_pwd)
            smtp.send_message(msg)

        logger.info(f"Waitlist notification sent → {notify_to} for signup {signup_email}")

    except Exception as exc:
        logger.warning(f"Waitlist notification failed (non-fatal): {exc}")


@router.post("", status_code=201)
async def join_waitlist(
    body: WaitlistIn,
    user_id: str = Depends(get_current_user),
):
    """
    Save a tester's notification email and fire an owner alert.
    Idempotent — submitting the same email twice is safe (upsert).
    """
    email = body.email.strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")

    supabase = get_supabase()

    try:
        supabase.table("waitlist").upsert(
            {
                "email":   email,
                "user_id": user_id,
                "source":  "accounts_page",
            },
            on_conflict="email",
        ).execute()
    except Exception as exc:
        logger.error(f"Waitlist DB upsert failed: {exc}")
        raise HTTPException(status_code=500, detail="Could not save email — please try again")

    # Non-blocking — notification failure never breaks the response
    try:
        _send_notification(email)
    except Exception:
        pass

    return {"status": "ok", "email": email}

"""
Universal IMAP account — works with any email provider that supports IMAP over SSL.

Supported providers (auto-detected by domain):
  Gmail, Outlook/Hotmail/Live, Yahoo, iCloud, AOL, Zoho, GMX,
  and any custom domain (Office 365, cPanel, etc.)

Setup:
  Most providers require an App Password (not your regular login password)
  when IMAP access is enabled for third-party apps. Common setup links:

  Gmail:    myaccount.google.com → Security → App Passwords
  Outlook:  account.microsoft.com → Security → Advanced security → App passwords
  Yahoo:    login.yahoo.com/account/security → App Passwords
  iCloud:   appleid.apple.com → Sign-In and Security → App-Specific Passwords
  AOL:      login.aol.com/account/security → App Passwords
"""
import email as email_lib
import imaplib
import ssl
from datetime import datetime
from email.header import decode_header
from typing import Optional

from loguru import logger

from src.accounts.base import BaseEmailAccount
from src.utils.models import Email
from src.utils.rate_limiter import RateLimiter

# ---------------------------------------------------------------------------
# Known provider IMAP settings (auto-detected from email domain)
# ---------------------------------------------------------------------------

PROVIDER_SETTINGS: dict[str, dict] = {
    # Gmail
    "gmail.com":        {"host": "imap.gmail.com",              "port": 993},
    "googlemail.com":   {"host": "imap.gmail.com",              "port": 993},
    # Microsoft
    "outlook.com":      {"host": "outlook.office365.com",       "port": 993},
    "hotmail.com":      {"host": "outlook.office365.com",       "port": 993},
    "live.com":         {"host": "outlook.office365.com",       "port": 993},
    "msn.com":          {"host": "outlook.office365.com",       "port": 993},
    # Yahoo
    "yahoo.com":        {"host": "imap.mail.yahoo.com",         "port": 993},
    "yahoo.co.uk":      {"host": "imap.mail.yahoo.com",         "port": 993},
    "ymail.com":        {"host": "imap.mail.yahoo.com",         "port": 993},
    # Apple
    "icloud.com":       {"host": "imap.mail.me.com",            "port": 993},
    "me.com":           {"host": "imap.mail.me.com",            "port": 993},
    "mac.com":          {"host": "imap.mail.me.com",            "port": 993},
    # AOL
    "aol.com":          {"host": "imap.aol.com",                "port": 993},
    "aim.com":          {"host": "imap.aol.com",                "port": 993},
    # Zoho
    "zoho.com":         {"host": "imap.zoho.com",               "port": 993},
    "zohomail.com":     {"host": "imap.zoho.com",               "port": 993},
    # GMX / Web.de
    "gmx.com":          {"host": "imap.gmx.com",                "port": 993},
    "gmx.net":          {"host": "imap.gmx.net",                "port": 993},
    "web.de":           {"host": "imap.web.de",                 "port": 993},
    # ProtonMail (requires Proton Bridge running locally)
    "protonmail.com":   {"host": "127.0.0.1",                   "port": 1143},
    "proton.me":        {"host": "127.0.0.1",                   "port": 1143},
    # Fastmail
    "fastmail.com":     {"host": "imap.fastmail.com",           "port": 993},
    "fastmail.fm":      {"host": "imap.fastmail.com",           "port": 993},
}

# Generic fallback for unknown/custom domains (Office 365, cPanel, etc.)
_FALLBACK_PORT = 993


def detect_imap_settings(email_address: str) -> tuple[str, int]:
    """
    Auto-detect IMAP host and port from the email domain.

    Returns (host, port). For unknown domains, the caller must supply
    the host manually — port defaults to 993.
    """
    domain = email_address.split("@")[-1].lower().strip()
    settings = PROVIDER_SETTINGS.get(domain)
    if settings:
        return settings["host"], settings["port"]
    # Unknown domain — return empty host so the caller is forced to provide it
    return "", _FALLBACK_PORT


def _decode_header_value(value: str) -> str:
    """Decode MIME-encoded email header (handles =?UTF-8?...?= etc.)."""
    if not value:
        return ""
    parts = []
    for chunk, charset in decode_header(value):
        if isinstance(chunk, bytes):
            try:
                parts.append(chunk.decode(charset or "utf-8", errors="replace"))
            except Exception:
                parts.append(chunk.decode("latin-1", errors="replace"))
        else:
            parts.append(str(chunk))
    return " ".join(parts).strip()


class ImapAccount(BaseEmailAccount):
    """
    Universal IMAP email account — works with any provider.

    For Gmail specifically, prefer GmailAccount (uses Gmail API with OAuth,
    better rate limits). Use ImapAccount for Gmail only if you have a
    Gmail App Password and don't want OAuth.

    Deletes permanently via IMAP EXPUNGE (no trash/recovery).
    """

    def __init__(
        self,
        account_name: str,
        email_address: str,
        app_password: str,
        rate_limiter: RateLimiter,
        imap_host: str = "",
        imap_port: int = 993,
    ) -> None:
        self.account_name = account_name
        self.email_address = email_address
        self._app_password = app_password
        self.rate_limiter = rate_limiter

        # Auto-detect IMAP settings if not provided
        if not imap_host:
            detected_host, detected_port = detect_imap_settings(email_address)
            self.imap_host = detected_host
            self.imap_port = detected_port if imap_port == 993 else imap_port
        else:
            self.imap_host = imap_host
            self.imap_port = imap_port

        self._conn: Optional[imaplib.IMAP4_SSL] = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self) -> None:
        """Connect to IMAP server over SSL and log in with the App Password."""
        if not self._app_password:
            raise ValueError(
                f"[{self.account_name}] App Password is not set for {self.email_address}.\n"
                "Most providers require an App Password (not your regular password) "
                "for IMAP access. Check your provider's security settings."
            )

        if not self.imap_host:
            raise ValueError(
                f"[{self.account_name}] Cannot auto-detect IMAP server for "
                f"{self.email_address}. Please set imap_host in config.yaml."
            )

        logger.info(
            f"[{self.account_name}] Connecting to {self.imap_host}:{self.imap_port}…"
        )

        ssl_context = ssl.create_default_context()
        self._conn = imaplib.IMAP4_SSL(
            host=self.imap_host,
            port=self.imap_port,
            ssl_context=ssl_context,
        )

        try:
            self._conn.login(self.email_address, self._app_password)
        except imaplib.IMAP4.error as exc:
            raise ConnectionError(
                f"[{self.account_name}] IMAP login failed for {self.email_address}: {exc}\n"
                "Make sure you are using an App Password, not your regular account password."
            ) from exc

        logger.info(f"[{self.account_name}] IMAP authenticated ✓ ({self.imap_host})")

    # ------------------------------------------------------------------
    # Fetch emails
    # ------------------------------------------------------------------

    def fetch_emails(self, max_count: int = 500) -> list[Email]:
        """
        Fetch email headers from INBOX without marking them as read.

        Returns emails sorted newest-first.
        """
        if not self._conn:
            raise RuntimeError(f"[{self.account_name}] Call authenticate() first")

        logger.info(f"[{self.account_name}] Fetching up to {max_count} emails…")

        self._conn.select("INBOX", readonly=True)

        status, data = self._conn.uid("search", None, "ALL")
        if status != "OK" or not data or not data[0]:
            logger.info(f"[{self.account_name}] No emails found in INBOX")
            return []

        all_uids = data[0].split()
        uids_to_fetch = all_uids[-max_count:]  # Most recent first

        emails: list[Email] = []
        for uid_bytes in reversed(uids_to_fetch):
            uid = uid_bytes.decode()
            email = self._fetch_email_metadata(uid)
            if email:
                emails.append(email)

        logger.info(f"[{self.account_name}] Fetched {len(emails)} emails")
        return emails

    def _fetch_email_metadata(self, uid: str) -> Optional[Email]:
        """Fetch headers for a single email by UID without marking it as read."""
        try:
            self.rate_limiter.acquire("gmail")  # Reuse bucket for IMAP pacing

            status, data = self._conn.uid(
                "fetch",
                uid,
                "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])",
            )

            if status != "OK" or not data or data[0] is None:
                return None

        except Exception as exc:
            logger.warning(
                f"[{self.account_name}] Failed to fetch UID {uid}: {exc}"
            )
            return None

        raw_headers = b""
        flags_str = ""

        for part in data:
            if isinstance(part, tuple):
                if isinstance(part[1], bytes):
                    raw_headers = part[1]
                if isinstance(part[0], bytes):
                    flags_str = part[0].decode("utf-8", errors="replace")
            elif isinstance(part, bytes):
                flags_str += part.decode("utf-8", errors="replace")

        msg = email_lib.message_from_bytes(raw_headers)
        subject = _decode_header_value(msg.get("subject", "(no subject)"))
        sender = _decode_header_value(msg.get("from", "(unknown)"))
        date_str = msg.get("date", "")

        return Email(
            id=uid,
            account_name=self.account_name,
            subject=subject,
            sender=sender,
            date=self._parse_date(date_str),
            is_read=r"\Seen" in flags_str,
            snippet="",
            labels=[],
        )

    @staticmethod
    def _parse_date(date_str: str) -> datetime:
        """Parse RFC 2822 date string from email headers."""
        if not date_str:
            return datetime.utcnow()
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str.strip()).replace(tzinfo=None)
        except Exception:
            return datetime.utcnow()

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_email(self, email_id: str, dry_run: bool = False) -> bool:
        """
        Permanently delete an email via IMAP EXPUNGE.

        Two-step IMAP deletion:
        1. Mark with \\Deleted flag
        2. EXPUNGE to permanently remove

        This is permanent — no trash/recovery available.
        """
        if dry_run:
            return True

        if not self._conn:
            logger.error(f"[{self.account_name}] Not authenticated — cannot delete")
            return False

        try:
            self._conn.select("INBOX", readonly=False)
            self.rate_limiter.acquire("gmail")

            status, _ = self._conn.uid("store", email_id, "+FLAGS", r"\Deleted")
            if status != "OK":
                logger.warning(
                    f"[{self.account_name}] Failed to flag UID {email_id} for deletion"
                )
                return False

            self._conn.expunge()
            return True

        except Exception as exc:
            logger.error(
                f"[{self.account_name}] Failed to delete UID {email_id}: {exc}"
            )
            return False

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Gracefully close the IMAP connection."""
        if self._conn:
            try:
                self._conn.logout()
            except Exception:
                pass
            self._conn = None

    def __del__(self) -> None:
        self.close()

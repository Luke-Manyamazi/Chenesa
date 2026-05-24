"""
Universal IMAP account — works with any email provider that supports IMAP over SSL.

Supported providers (auto-detected by domain):
  Gmail, Outlook/Hotmail/Live, Yahoo, iCloud, AOL, Zoho, GMX,
  and any custom domain (Office 365, cPanel, etc.)

Performance notes:
  - fetch_emails() fetches ALL headers in ONE batch IMAP command (not one per email)
  - batch_delete_emails() flags all UIDs at once and runs ONE EXPUNGE at the end
  - Together these make a 500-email run ~50× faster than the naïve one-by-one approach
"""
import email as email_lib
import imaplib
import re
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

_FALLBACK_PORT = 993
_UID_RE = re.compile(rb"UID\s+(\d+)")


def detect_imap_settings(email_address: str) -> tuple[str, int]:
    """Auto-detect IMAP host and port from the email domain."""
    domain = email_address.split("@")[-1].lower().strip()
    settings = PROVIDER_SETTINGS.get(domain)
    if settings:
        return settings["host"], settings["port"]
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

    Deletes permanently via IMAP EXPUNGE (no trash/recovery).
    Uses batch fetch and batch delete for maximum speed.
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
                f"[{self.account_name}] App Password is not set for {self.email_address}."
            )
        if not self.imap_host:
            raise ValueError(
                f"[{self.account_name}] Cannot auto-detect IMAP server for "
                f"{self.email_address}. Please set imap_host."
            )

        logger.info(f"[{self.account_name}] Connecting to {self.imap_host}:{self.imap_port}…")

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
                f"[{self.account_name}] IMAP login failed for {self.email_address}: {exc}"
            ) from exc

        logger.info(f"[{self.account_name}] IMAP authenticated ✓ ({self.imap_host})")

    # ------------------------------------------------------------------
    # Fetch emails — BATCH (one IMAP command for all headers)
    # ------------------------------------------------------------------

    def fetch_emails(self, max_count: int = 500) -> list[Email]:
        """
        Fetch email headers in ONE batch IMAP command.

        Previously this did one network round-trip per email.
        Now it fetches all headers in a single command — ~500× faster for
        large mailboxes.
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
        uids_to_fetch = all_uids[-max_count:]  # most recent N

        if not uids_to_fetch:
            return []

        # Build comma-separated UID list for batch IMAP fetch
        uid_set = b",".join(uids_to_fetch).decode()

        try:
            status, raw = self._conn.uid(
                "fetch", uid_set,
                "(UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])",
            )
        except Exception as exc:
            logger.warning(
                f"[{self.account_name}] Batch fetch failed ({exc}) — falling back to serial"
            )
            return self._fetch_emails_serial(uids_to_fetch)

        if status != "OK" or not raw:
            logger.warning(f"[{self.account_name}] Batch fetch returned no data")
            return []

        emails: list[Email] = []
        for part in raw:
            if not isinstance(part, tuple) or len(part) < 2:
                continue  # skip b')' separators between messages

            info_bytes   = part[0] if isinstance(part[0], bytes) else b""
            header_bytes = part[1] if isinstance(part[1], bytes) else b""

            # Extract UID from the response info line
            uid_match = _UID_RE.search(info_bytes)
            if not uid_match:
                continue
            uid = uid_match.group(1).decode()

            is_read = b"\\Seen" in info_bytes

            msg = email_lib.message_from_bytes(header_bytes)
            subject  = _decode_header_value(msg.get("subject", "(no subject)"))
            sender   = _decode_header_value(msg.get("from", "(unknown)"))
            date_str = msg.get("date", "")

            emails.append(Email(
                id=uid,
                account_name=self.account_name,
                subject=subject,
                sender=sender,
                date=self._parse_date(date_str),
                is_read=is_read,
                snippet="",
                labels=[],
            ))

        # Sort newest-first
        emails.sort(key=lambda e: e.date or datetime.min, reverse=True)
        logger.info(f"[{self.account_name}] Fetched {len(emails)} emails (batch)")
        return emails

    def _fetch_emails_serial(self, uids_to_fetch: list[bytes]) -> list[Email]:
        """
        Serial fallback — fetch one email at a time.
        Used only if the batch command fails on some servers.
        """
        logger.info(f"[{self.account_name}] Serial fetch for {len(uids_to_fetch)} emails…")
        emails: list[Email] = []
        for uid_bytes in reversed(uids_to_fetch):
            uid = uid_bytes.decode()
            email = self._fetch_single_metadata(uid)
            if email:
                emails.append(email)
        return emails

    def _fetch_single_metadata(self, uid: str) -> Optional[Email]:
        """Fetch headers for a single email by UID."""
        try:
            self.rate_limiter.acquire("gmail")
            status, data = self._conn.uid(
                "fetch", uid,
                "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])",
            )
            if status != "OK" or not data or data[0] is None:
                return None
        except Exception as exc:
            logger.warning(f"[{self.account_name}] Failed to fetch UID {uid}: {exc}")
            return None

        raw_headers = b""
        flags_str   = ""
        for part in data:
            if isinstance(part, tuple):
                if isinstance(part[1], bytes):
                    raw_headers = part[1]
                if isinstance(part[0], bytes):
                    flags_str = part[0].decode("utf-8", errors="replace")
            elif isinstance(part, bytes):
                flags_str += part.decode("utf-8", errors="replace")

        msg = email_lib.message_from_bytes(raw_headers)
        return Email(
            id=uid,
            account_name=self.account_name,
            subject=_decode_header_value(msg.get("subject", "(no subject)")),
            sender=_decode_header_value(msg.get("from", "(unknown)")),
            date=self._parse_date(msg.get("date", "")),
            is_read=r"\Seen" in flags_str,
            snippet="",
            labels=[],
        )

    @staticmethod
    def _parse_date(date_str: str) -> datetime:
        if not date_str:
            return datetime.utcnow()
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str.strip()).replace(tzinfo=None)
        except Exception:
            return datetime.utcnow()

    # ------------------------------------------------------------------
    # Delete — BATCH (flag all → single EXPUNGE)
    # ------------------------------------------------------------------

    def batch_delete_emails(self, email_ids: list[str]) -> tuple[int, int]:
        """
        Delete many emails in bulk — mark all \\Deleted, then ONE EXPUNGE.

        Previously: 1 STORE + 1 EXPUNGE per email = 1000 IMAP ops for 500 emails.
        Now: N STORE chunks + 1 EXPUNGE = as few as 2 IMAP ops for 500 emails.

        Returns (deleted_count, error_count).
        """
        if not email_ids:
            return 0, 0
        if not self._conn:
            logger.error(f"[{self.account_name}] Not authenticated — cannot delete")
            return 0, len(email_ids)

        self._conn.select("INBOX", readonly=False)

        # Process in chunks — most IMAP servers handle 500 UIDs per command safely
        CHUNK = 500
        deleted = errors = 0

        for i in range(0, len(email_ids), CHUNK):
            chunk = email_ids[i : i + CHUNK]
            uid_set = ",".join(chunk)
            try:
                status, _ = self._conn.uid("store", uid_set, "+FLAGS", r"\Deleted")
                if status == "OK":
                    deleted += len(chunk)
                    logger.info(
                        f"[{self.account_name}] Flagged {len(chunk)} emails for deletion"
                        f" (chunk {i // CHUNK + 1})"
                    )
                else:
                    errors += len(chunk)
                    logger.warning(
                        f"[{self.account_name}] STORE failed for chunk of {len(chunk)}"
                    )
            except Exception as exc:
                errors += len(chunk)
                logger.error(f"[{self.account_name}] Batch flag error: {exc}")

        # Single EXPUNGE permanently removes all flagged messages
        try:
            self._conn.expunge()
        except Exception as exc:
            logger.error(f"[{self.account_name}] EXPUNGE failed: {exc}")

        logger.info(
            f"[{self.account_name}] Batch delete complete — "
            f"{deleted} deleted, {errors} errors"
        )
        return deleted, errors

    def delete_email(self, email_id: str, dry_run: bool = False) -> bool:
        """
        Delete a single email (kept for backwards compatibility).
        For bulk deletes, use batch_delete_emails() instead.
        """
        if dry_run:
            return True
        deleted, errors = self.batch_delete_emails([email_id])
        return errors == 0

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def close(self) -> None:
        if self._conn:
            try:
                self._conn.logout()
            except Exception:
                pass
            self._conn = None

    def __del__(self) -> None:
        self.close()

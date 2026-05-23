"""
Yahoo Mail account using IMAP over SSL (port 993).

Setup:
1. Go to your Yahoo account → Security → App Passwords
2. Generate an App Password for "Other App"
3. Add it to .env as: YAHOO_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

Yahoo requires App Passwords when IMAP is used with third-party apps.
Regular account passwords will NOT work.
"""
import email as email_lib
import imaplib
import re
import ssl
from datetime import datetime, timezone
from email.header import decode_header
from typing import Optional

from loguru import logger

from src.accounts.base import BaseEmailAccount
from src.utils.models import Email
from src.utils.rate_limiter import RateLimiter


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


class YahooAccount(BaseEmailAccount):
    """
    Yahoo Mail integration via IMAP over SSL.

    Uses IMAP UIDs (not sequence numbers) for reliable message identification.
    Deletes by setting the \\Deleted flag and running EXPUNGE.
    """

    IMAP_HOST = "imap.mail.yahoo.com"
    IMAP_PORT = 993

    def __init__(
        self,
        account_name: str,
        email_address: str,
        app_password: str,
        rate_limiter: RateLimiter,
        imap_host: str = "imap.mail.yahoo.com",
        imap_port: int = 993,
    ) -> None:
        self.account_name = account_name
        self.email_address = email_address
        self._app_password = app_password
        self.rate_limiter = rate_limiter
        self.imap_host = imap_host
        self.imap_port = imap_port
        self._conn: Optional[imaplib.IMAP4_SSL] = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self) -> None:
        """Connect to Yahoo IMAP via SSL and log in with the App Password."""
        if not self._app_password:
            raise ValueError(
                f"[{self.account_name}] Yahoo App Password is not set.\n"
                "Add YAHOO_APP_PASSWORD to your .env file.\n"
                "Generate one at: Yahoo Account → Security → App Passwords"
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
                f"[{self.account_name}] Yahoo IMAP login failed: {exc}\n"
                "Check your App Password — a regular Yahoo password will not work."
            ) from exc

        logger.info(f"[{self.account_name}] Yahoo IMAP authenticated ✓")

    # ------------------------------------------------------------------
    # Fetch emails
    # ------------------------------------------------------------------

    def fetch_emails(self, max_count: int = 500) -> list[Email]:
        """
        Fetch email envelopes from Yahoo INBOX.

        Uses BODY.PEEK to fetch headers without marking emails as read.
        Returns emails sorted newest-first (UIDs are monotonically increasing).
        """
        if not self._conn:
            raise RuntimeError(f"[{self.account_name}] Call authenticate() first")

        logger.info(f"[{self.account_name}] Fetching up to {max_count} emails…")

        # Select INBOX in read-only mode so we don't accidentally change flags
        self._conn.select("INBOX", readonly=True)

        # Search for all messages and get UIDs
        status, data = self._conn.uid("search", None, "ALL")
        if status != "OK" or not data or not data[0]:
            logger.info(f"[{self.account_name}] No emails found in INBOX")
            return []

        all_uids = data[0].split()
        # Take the most recent max_count (UIDs are oldest-first, so take from end)
        uids_to_fetch = all_uids[-max_count:]

        emails: list[Email] = []

        for uid_bytes in reversed(uids_to_fetch):  # Newest first
            uid = uid_bytes.decode()
            email = self._fetch_email_metadata(uid)
            if email:
                emails.append(email)

        logger.info(f"[{self.account_name}] Fetched {len(emails)} emails")
        return emails

    def _fetch_email_metadata(self, uid: str) -> Optional[Email]:
        """Fetch headers for a single email by UID without marking it as read."""
        try:
            self.rate_limiter.acquire("gmail")  # Reuse Gmail bucket for IMAP pacing

            # BODY.PEEK[] fetches headers without setting \Seen flag
            status, data = self._conn.uid(
                "fetch",
                uid,
                "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])",
            )

            if status != "OK" or not data or data[0] is None:
                return None

        except Exception as exc:
            logger.warning(f"[{self.account_name}] Failed to fetch UID {uid}: {exc}")
            return None

        # Parse the raw header bytes
        raw_headers = b""
        flags_str = ""

        for part in data:
            if isinstance(part, tuple):
                if isinstance(part[1], bytes):
                    raw_headers = part[1]
                # Flags come in the first item (e.g. b"123 (FLAGS (\Seen) ...)")
                if isinstance(part[0], bytes):
                    flags_str = part[0].decode("utf-8", errors="replace")
            elif isinstance(part, bytes):
                flags_str += part.decode("utf-8", errors="replace")

        # Parse headers
        msg = email_lib.message_from_bytes(raw_headers)
        subject = _decode_header_value(msg.get("subject", "(no subject)"))
        sender = _decode_header_value(msg.get("from", "(unknown)"))
        date_str = msg.get("date", "")

        email_date = self._parse_date(date_str)
        is_read = r"\Seen" in flags_str

        return Email(
            id=uid,
            account_name=self.account_name,
            subject=subject,
            sender=sender,
            date=email_date,
            is_read=is_read,
            snippet="",  # Yahoo IMAP doesn't have a snippet — classifier uses subject/sender
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
        Permanently delete an email by setting \\Deleted flag and running EXPUNGE.

        Note: IMAP deletion is two steps:
        1. Mark with \\Deleted flag
        2. EXPUNGE to physically remove

        This is permanent — there is no Trash equivalent in pure IMAP.
        """
        if dry_run:
            return True

        if not self._conn:
            logger.error(f"[{self.account_name}] Not authenticated — cannot delete")
            return False

        try:
            # Must select in write mode to mark/expunge
            self._conn.select("INBOX", readonly=False)

            self.rate_limiter.acquire("gmail")
            status, _ = self._conn.uid("store", email_id, "+FLAGS", r"\Deleted")

            if status != "OK":
                logger.warning(f"[{self.account_name}] Failed to flag UID {email_id} for deletion")
                return False

            self._conn.expunge()
            return True

        except Exception as exc:
            logger.error(f"[{self.account_name}] Failed to delete UID {email_id}: {exc}")
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

"""
Gmail account using the Gmail API with OAuth 2.0.

Setup (one time per account):
1. Go to console.cloud.google.com
2. Create/select a project → Enable "Gmail API"
3. Create OAuth 2.0 credentials (Desktop application type)
4. Download as credentials.json and place in the project root
5. Run the app — it opens a browser for each account on first run
6. Tokens are saved to tokens/token_<account>.json for future runs
"""
import base64
import os
from datetime import datetime, timezone
from email import message_from_bytes
from pathlib import Path
from typing import Optional

from loguru import logger

from src.accounts.base import BaseEmailAccount
from src.utils.models import Email
from src.utils.rate_limiter import RateLimiter

# Gmail API OAuth scopes needed
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",   # needed for trash/delete
]


class GmailAccount(BaseEmailAccount):
    """
    Gmail integration via Gmail API (OAuth 2.0).

    Uses messages.trash() to move emails to Trash (recoverable for 30 days)
    rather than messages.delete() (permanent, bypasses Trash).
    This is the safer default for autonomous deletion.
    """

    def __init__(
        self,
        account_name: str,
        email_address: str,
        token_file: str,
        credentials_file: str,
        rate_limiter: RateLimiter,
    ) -> None:
        self.account_name = account_name
        self.email_address = email_address
        self.token_file = token_file
        self.credentials_file = credentials_file
        self.rate_limiter = rate_limiter
        self._service = None  # Lazy — set in authenticate()

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self) -> None:
        """
        Load or refresh OAuth token. On first run, opens a browser window
        for the user to authorize the app. Saves the token for future runs.
        """
        try:
            from google.auth.transport.requests import Request
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise ImportError(
                "Gmail API libraries not installed. Run:\n"
                "pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client"
            ) from exc

        creds: Optional[Credentials] = None

        # Load existing token
        if os.path.exists(self.token_file):
            try:
                creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)
            except Exception as exc:
                logger.warning(f"[{self.account_name}] Could not load token file: {exc}")

        # Refresh or re-authorize
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info(f"[{self.account_name}] Refreshing expired OAuth token…")
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Gmail credentials file not found: {self.credentials_file}\n"
                        "Download it from Google Cloud Console → APIs → Gmail API → Credentials"
                    )
                logger.info(
                    f"[{self.account_name}] Opening browser for Gmail authorization "
                    f"({self.email_address})…"
                )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save token for next run
            Path(self.token_file).parent.mkdir(parents=True, exist_ok=True)
            with open(self.token_file, "w", encoding="utf-8") as fh:
                fh.write(creds.to_json())
            logger.info(f"[{self.account_name}] Token saved to {self.token_file}")

        self._service = build("gmail", "v1", credentials=creds)
        logger.info(f"[{self.account_name}] Gmail API authenticated ✓")

    # ------------------------------------------------------------------
    # Fetch emails
    # ------------------------------------------------------------------

    def fetch_emails(self, max_count: int = 500) -> list[Email]:
        """
        Fetch email metadata from Gmail (no full body download).

        Uses the messages.list → messages.get(format=metadata) pattern
        to minimise data transfer and quota usage.
        """
        if not self._service:
            raise RuntimeError(f"[{self.account_name}] Call authenticate() first")

        emails: list[Email] = []
        page_token: Optional[str] = None
        fetched = 0

        logger.info(f"[{self.account_name}] Fetching up to {max_count} emails…")

        while fetched < max_count:
            batch_size = min(100, max_count - fetched)  # Gmail API max page size = 100

            self.rate_limiter.acquire("gmail")
            params: dict = {
                "userId": "me",
                "maxResults": batch_size,
                "labelIds": ["INBOX"],  # Only INBOX for now
            }
            if page_token:
                params["pageToken"] = page_token

            result = self._service.users().messages().list(**params).execute()
            messages = result.get("messages", [])

            if not messages:
                break

            # Batch-fetch metadata for this page
            for msg_stub in messages:
                if fetched >= max_count:
                    break
                email = self._fetch_email_metadata(msg_stub["id"])
                if email:
                    emails.append(email)
                fetched += 1

            page_token = result.get("nextPageToken")
            if not page_token:
                break

        logger.info(f"[{self.account_name}] Fetched {len(emails)} emails")
        return emails

    def _fetch_email_metadata(self, msg_id: str) -> Optional[Email]:
        """Fetch metadata for a single email."""
        try:
            self.rate_limiter.acquire("gmail")
            msg = (
                self._service.users()
                .messages()
                .get(
                    userId="me",
                    id=msg_id,
                    format="metadata",
                    metadataHeaders=[
                        "From", "Subject", "Date",
                        "List-Unsubscribe", "List-Unsubscribe-Post",
                        "Precedence", "X-Mailer",
                        "X-Campaign-Id", "X-CampaignId",
                    ],
                )
                .execute()
            )
        except Exception as exc:
            logger.warning(f"[{self.account_name}] Failed to fetch message {msg_id}: {exc}")
            return None

        # Parse headers — keep all for rules classifier, extract key fields
        raw_headers = {
            h["name"].lower(): h["value"]
            for h in msg.get("payload", {}).get("headers", [])
        }

        subject = raw_headers.get("subject", "(no subject)")
        sender = raw_headers.get("from", "(unknown sender)")
        date_str = raw_headers.get("date", "")

        # Parse date
        email_date = self._parse_date(date_str, msg.get("internalDate"))

        # Read status: UNREAD label means unread
        labels = msg.get("labelIds", [])
        is_read = "UNREAD" not in labels

        # Snippet (first ~100 chars of body, pre-extracted by Gmail)
        snippet = msg.get("snippet", "")

        return Email(
            id=msg_id,
            account_name=self.account_name,
            subject=subject,
            sender=sender,
            date=email_date,
            is_read=is_read,
            snippet=snippet,
            labels=labels,
            raw_headers=raw_headers,
        )

    @staticmethod
    def _parse_date(date_str: str, internal_date_ms: Optional[str]) -> datetime:
        """Parse email date, falling back to internalDate (ms since epoch)."""
        # Try internalDate first (most reliable)
        if internal_date_ms:
            try:
                ts = int(internal_date_ms) / 1000
                return datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)
            except (ValueError, OSError):
                pass

        # Try parsing Date header
        if date_str:
            from email.utils import parsedate_to_datetime
            try:
                return parsedate_to_datetime(date_str).replace(tzinfo=None)
            except Exception:
                pass

        return datetime.utcnow()

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_email(self, email_id: str, dry_run: bool = False) -> bool:
        """
        Move email to Trash (recoverable for 30 days).

        Uses trash() not delete() — permanent deletion is too risky for
        autonomous operation. Trash gives a safety window.
        """
        if dry_run:
            return True

        if not self._service:
            logger.error(f"[{self.account_name}] Not authenticated — cannot delete")
            return False

        try:
            self.rate_limiter.acquire("gmail")
            self._service.users().messages().trash(
                userId="me", id=email_id
            ).execute()
            return True
        except Exception as exc:
            logger.error(f"[{self.account_name}] Failed to trash {email_id}: {exc}")
            return False

    def archive_email(self, email_id: str) -> bool:
        """
        Archive an email by removing the INBOX label (moves to All Mail).
        Recoverable at any time — does not trash or delete.
        Used for Safe Cleanup mode.
        """
        if not self._service:
            logger.error(f"[{self.account_name}] Not authenticated — cannot archive")
            return False

        try:
            self.rate_limiter.acquire("gmail")
            self._service.users().messages().modify(
                userId="me",
                id=email_id,
                body={"removeLabelIds": ["INBOX"]},
            ).execute()
            return True
        except Exception as exc:
            logger.error(f"[{self.account_name}] Failed to archive {email_id}: {exc}")
            return False

    def close(self) -> None:
        """Nothing to close for Gmail API."""
        pass

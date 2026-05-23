"""
Abstract base class for email account providers.
"""
from abc import ABC, abstractmethod

from src.utils.models import Email


class BaseEmailAccount(ABC):
    """
    Common interface that all email account providers must implement.
    """

    account_name: str
    email_address: str

    @abstractmethod
    def authenticate(self) -> None:
        """Authenticate with the email provider. Raises on failure."""
        ...

    @abstractmethod
    def fetch_emails(self, max_count: int = 500) -> list[Email]:
        """
        Fetch email metadata (not full bodies) from the account.

        Args:
            max_count: Maximum number of emails to return.

        Returns:
            List of Email objects with enough metadata to classify.
        """
        ...

    @abstractmethod
    def delete_email(self, email_id: str, dry_run: bool = False) -> bool:
        """
        Permanently delete a single email.

        Args:
            email_id: Provider-specific ID returned from fetch_emails().
            dry_run: If True, do nothing and return True.

        Returns:
            True on success, False on failure.
        """
        ...

    def close(self) -> None:
        """Optional cleanup (close connections, etc.)."""

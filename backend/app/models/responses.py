from pydantic import BaseModel
from typing import Optional, List


class AccountOut(BaseModel):
    id: str
    email: str
    type: str
    enabled: bool
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    created_at: str


class DeletedEmailOut(BaseModel):
    subject: str
    sender: str
    category: str
    reasoning: str


class RunOut(BaseModel):
    id: str
    account_id: str
    account_email: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None
    emails_fetched: int = 0
    emails_deleted: int = 0
    emails_kept: int = 0
    status: str
    error_message: Optional[str] = None


class RunDetailOut(RunOut):
    deleted_emails: List[DeletedEmailOut] = []

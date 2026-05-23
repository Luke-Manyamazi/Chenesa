from pydantic import BaseModel
from typing import Optional


class ConnectImapRequest(BaseModel):
    email: str
    app_password: str
    imap_host: Optional[str] = None
    imap_port: Optional[int] = 993


class TriggerRunRequest(BaseModel):
    account_id: str


class ToggleAccountRequest(BaseModel):
    enabled: bool

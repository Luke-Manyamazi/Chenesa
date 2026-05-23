import json
from google_auth_oauthlib.flow import Flow
from ..config import get_settings

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


def _flow() -> Flow:
    s = get_settings()
    return Flow.from_client_config(
        {
            "web": {
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "redirect_uris": [s.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=s.google_redirect_uri,
    )


def get_auth_url(state: str) -> str:
    url, _ = _flow().authorization_url(access_type="offline", prompt="consent", state=state)
    return url


def exchange_code(code: str) -> dict:
    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
    }

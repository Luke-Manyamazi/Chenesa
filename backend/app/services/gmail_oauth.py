import json
from google_auth_oauthlib.flow import Flow
from ..config import get_settings

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

# In-memory store: state (user_id) -> code_verifier
# Needed because the auth URL step and the callback step create separate Flow instances.
# If the server restarts between the two steps the user just has to retry — acceptable.
_verifier_store: dict[str, str] = {}


def _make_flow() -> Flow:
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
    flow = _make_flow()
    url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
    )
    # Capture code_verifier if the library auto-generated PKCE
    verifier = getattr(flow, "code_verifier", None) or getattr(
        getattr(flow, "oauth2session", None), "code_verifier", None
    )
    if verifier:
        _verifier_store[state] = verifier
    else:
        _verifier_store.pop(state, None)  # clear any stale entry
    return url


def exchange_code(code: str, state: str | None = None) -> dict:
    flow = _make_flow()
    # Restore the verifier that was captured during get_auth_url, if any
    verifier = _verifier_store.pop(state, None) if state else None

    if verifier:
        flow.fetch_token(code=code, code_verifier=verifier)
    else:
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

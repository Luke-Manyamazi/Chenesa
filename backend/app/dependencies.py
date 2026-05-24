import httpx
from fastapi import Header, HTTPException
from .config import get_settings

# One shared client — reuses TCP/TLS connections across all requests.
# Created once at import time, lives for the process lifetime.
_http = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=5.0, read=8.0, write=5.0, pool=5.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
)


async def get_current_user(authorization: str = Header(...)) -> str:
    """Verify Supabase JWT via auth API. Uses a persistent HTTP client for speed."""
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    settings = get_settings()
    try:
        resp = await _http.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_service_role_key,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()["id"]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

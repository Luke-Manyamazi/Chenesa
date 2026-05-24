import httpx
from fastapi import Header, HTTPException
from .config import get_settings


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    Verify Supabase JWT by calling the Supabase auth REST API directly
    using httpx (fully async — never blocks the event loop).
    """
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
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

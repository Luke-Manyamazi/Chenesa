import asyncio
from fastapi import Header, HTTPException
from .db.supabase import get_supabase


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    Verify Supabase JWT via the auth API, run in a thread pool so the
    sync Supabase client never blocks the async event loop.
    """
    try:
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")

        supabase = get_supabase()
        # asyncio.to_thread runs the blocking call in a thread pool —
        # the event loop stays free to handle other requests.
        response = await asyncio.to_thread(supabase.auth.get_user, token)

        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        return response.user.id

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

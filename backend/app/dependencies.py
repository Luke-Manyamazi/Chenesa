from fastapi import Header, HTTPException
from .db.supabase import get_supabase


async def get_current_user(authorization: str = Header(...)) -> str:
    """Verify the Supabase JWT by calling Supabase auth — no local secret needed."""
    try:
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")

        supabase = get_supabase()
        response = supabase.auth.get_user(token)

        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        return response.user.id

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

import base64
from fastapi import Header, HTTPException
from jose import jwt, JWTError
from .config import get_settings


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    Verify Supabase JWT locally — fast, non-blocking, no network call.
    Supabase signs tokens with the raw bytes of the base64-decoded secret.
    """
    try:
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")

        settings = get_settings()
        raw_secret = settings.supabase_jwt_secret

        # Supabase uses the base64-decoded bytes as the HMAC key.
        # Try decoded first, fall back to raw string.
        secrets_to_try: list = []
        try:
            secrets_to_try.append(base64.b64decode(raw_secret))
        except Exception:
            pass
        secrets_to_try.append(raw_secret)

        last_err: Exception = Exception("Invalid token")
        for secret in secrets_to_try:
            try:
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )
                return payload["sub"]
            except JWTError as e:
                last_err = e
                continue

        raise HTTPException(status_code=401, detail="Invalid or expired token")

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

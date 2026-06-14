from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    anthropic_api_key: str
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    encryption_key: str
    scheduler_secret: str = ""
    frontend_url: str = "http://localhost:3000"

    # PayFast (South African payment gateway)
    payfast_merchant_id:  str  = ""
    payfast_merchant_key: str  = ""
    payfast_passphrase:   str  = ""
    payfast_sandbox:      bool = True

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()

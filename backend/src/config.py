"""
Configuration loader — merges config.yaml with .env secrets.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv


@dataclass
class GlobalConfig:
    dry_run: bool = False
    batch_size: int = 20
    max_emails_per_run: int = 500
    old_read_days: int = 30
    schedule_interval_hours: int = 6


@dataclass
class RateLimitConfig:
    gmail_requests_per_second: float = 5.0
    anthropic_requests_per_minute: float = 50.0


@dataclass
class AccountConfig:
    name: str
    type: str                        # "gmail" | "imap" | "yahoo" | "outlook" | "icloud" | "aol" | "zoho"
    email: str
    enabled: bool = True
    old_read_days: Optional[int] = None
    # Gmail-specific
    token_file: Optional[str] = None
    credentials_file: Optional[str] = None
    # IMAP-based accounts (Yahoo, Outlook, iCloud, AOL, Zoho, custom domains)
    imap_host: str = ""              # Auto-detected from email domain if left empty
    imap_port: int = 993
    app_password: Optional[str] = None  # Per-account app password (overrides env var)


@dataclass
class AppConfig:
    anthropic_api_key: str
    yahoo_app_password: str          # Legacy env var — used as fallback for IMAP accounts
    global_: GlobalConfig = field(default_factory=GlobalConfig)
    rate_limits: RateLimitConfig = field(default_factory=RateLimitConfig)
    accounts: list = field(default_factory=list)


def load_config(config_path: str = "config.yaml") -> AppConfig:
    """
    Load configuration from YAML + .env file.
    Raises clear errors if required secrets are missing.
    """
    # Load .env (silently ignored if file doesn't exist)
    load_dotenv()

    # --- Secrets from environment ---
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    yahoo_password = os.environ.get("YAHOO_APP_PASSWORD", "")

    if not anthropic_key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY is not set.\n"
            "1. Copy .env.example → .env\n"
            "2. Add your Anthropic API key from console.anthropic.com"
        )

    # --- YAML config ---
    yaml_path = Path(config_path)
    if not yaml_path.exists():
        raise FileNotFoundError(
            f"Config file not found: {config_path}\n"
            "Make sure config.yaml exists in the project directory."
        )

    with open(yaml_path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    # --- Parse global settings ---
    g = raw.get("global", {})
    global_cfg = GlobalConfig(
        dry_run=g.get("dry_run", False),
        batch_size=g.get("batch_size", 20),
        max_emails_per_run=g.get("max_emails_per_run", 500),
        old_read_days=g.get("old_read_days", 30),
        schedule_interval_hours=g.get("schedule_interval_hours", 6),
    )

    # --- Parse rate limits ---
    rl = raw.get("rate_limits", {})
    rate_cfg = RateLimitConfig(
        gmail_requests_per_second=rl.get("gmail_requests_per_second", 5.0),
        anthropic_requests_per_minute=rl.get("anthropic_requests_per_minute", 50.0),
    )

    # --- Parse accounts ---
    accounts_raw = raw.get("accounts", {})
    accounts = []
    for name, acc in accounts_raw.items():
        accounts.append(AccountConfig(
            name=name,
            type=acc.get("type", "gmail"),
            email=acc.get("email", ""),
            enabled=acc.get("enabled", True),
            old_read_days=acc.get("old_read_days"),
            token_file=acc.get("token_file"),
            credentials_file=acc.get("credentials_file", "credentials.json"),
            imap_host=acc.get("imap_host", ""),       # Empty = auto-detect from domain
            imap_port=acc.get("imap_port", 993),
            app_password=acc.get("app_password"),      # Per-account password in config
        ))

    return AppConfig(
        anthropic_api_key=anthropic_key,
        yahoo_app_password=yahoo_password,
        global_=global_cfg,
        rate_limits=rate_cfg,
        accounts=accounts,
    )

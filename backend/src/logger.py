"""
Loguru logging setup: colorized console + rotating daily file.
"""
import sys
from pathlib import Path
from loguru import logger


def setup_logger(log_dir: str = "logs", level: str = "INFO") -> None:
    """Configure loguru with console and file handlers."""
    logger.remove()  # Remove default handler

    # Console: INFO+, colorized
    logger.add(
        sys.stderr,
        level=level,
        format=(
            "<green>{time:HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "{message}"
        ),
        colorize=True,
    )

    # File: DEBUG+, rotating daily, kept 30 days
    Path(log_dir).mkdir(exist_ok=True)
    logger.add(
        f"{log_dir}/email_cleaner_{{time:YYYY-MM-DD}}.log",
        level="DEBUG",
        rotation="00:00",      # New file at midnight
        retention="30 days",
        compression="zip",
        format=(
            "{time:YYYY-MM-DD HH:mm:ss} | "
            "{level: <8} | "
            "{name}:{function}:{line} | "
            "{message}"
        ),
        encoding="utf-8",
    )


def get_logger(name: str):
    """Return a bound logger for a module."""
    return logger.bind(name=name)

"""
Main orchestrator — runs the full pipeline for each email account:
  Authenticate → Fetch → Pre-classify OLD_READ → Claude classify → Delete
"""
from datetime import datetime
from typing import Optional

from loguru import logger
from rich.console import Console
from rich.table import Table
from rich import box

from src.accounts.base import BaseEmailAccount
from src.accounts.gmail import GmailAccount
from src.accounts.imap import ImapAccount
from src.accounts.yahoo import YahooAccount  # kept for backwards compatibility
from src.classifier.claude_classifier import ClaudeClassifier
from src.config import AccountConfig, AppConfig
from src.utils.models import (
    ClassificationResult,
    DELETE_CATEGORIES,
    Email,
    EmailCategory,
    RunStats,
)
from src.utils.rate_limiter import RateLimiter


class EmailCleaner:
    """
    Orchestrates email cleaning across all configured accounts.

    Pipeline per account:
    1. Authenticate
    2. Fetch email metadata (no full body download)
    3. Pre-classify OLD_READ emails deterministically (no Claude needed)
    4. Batch-classify remaining emails with Claude Haiku
    5. Delete/skip based on classification
    6. Log and report results
    """

    def __init__(self, config: AppConfig, dry_run: bool = False) -> None:
        self.config = config
        self.dry_run = dry_run

        self.rate_limiter = RateLimiter(
            gmail_rps=config.rate_limits.gmail_requests_per_second,
            anthropic_rpm=config.rate_limits.anthropic_requests_per_minute,
        )
        self.classifier = ClaudeClassifier(
            api_key=config.anthropic_api_key,
            rate_limiter=self.rate_limiter,
        )
        self.console = Console(legacy_windows=False)

    # ------------------------------------------------------------------
    # Public: run all accounts
    # ------------------------------------------------------------------

    def run_all(self) -> list[RunStats]:
        """
        Process all enabled accounts and print a Rich summary table.

        Returns:
            List of RunStats — one per account (including disabled/error accounts).
        """
        all_stats: list[RunStats] = []

        enabled_accounts = [a for a in self.config.accounts if a.enabled]
        if not enabled_accounts:
            logger.warning("No enabled accounts found in config.yaml")
            return []

        mode = "DRY RUN — no emails will be deleted" if self.dry_run else "LIVE RUN"
        self.console.print(f"\n[bold cyan]Email Cleaner — {mode}[/bold cyan]")
        self.console.print(f"Processing {len(enabled_accounts)} account(s)…\n")

        for account_config in enabled_accounts:
            stats = RunStats(account=account_config.name)
            account = self._build_account(account_config)

            if account is None:
                stats.error_message = f"Unknown account type: {account_config.type!r}"
                logger.error(f"[{account_config.name}] {stats.error_message}")
                all_stats.append(stats)
                continue

            try:
                self._process_account(account, account_config, stats)
            except Exception as exc:
                stats.error_message = str(exc)
                logger.error(
                    f"[{account_config.name}] Account processing failed: {exc}",
                    exc_info=True,
                )
            finally:
                account.close()

            all_stats.append(stats)

        self._print_summary(all_stats)
        return all_stats

    # ------------------------------------------------------------------
    # Per-account pipeline
    # ------------------------------------------------------------------

    def _process_account(
        self,
        account: BaseEmailAccount,
        account_config: AccountConfig,
        stats: RunStats,
    ) -> None:
        """Run the full clean pipeline for one account."""
        logger.info(f"[{account_config.name}] === Starting ===")

        # 1. Authenticate
        account.authenticate()

        # 2. Fetch
        max_emails = account_config.get("max_emails_per_run") if hasattr(account_config, "get") else None
        max_emails = max_emails or self.config.global_.max_emails_per_run

        emails = account.fetch_emails(max_count=max_emails)
        stats.fetched = len(emails)

        if not emails:
            logger.info(f"[{account_config.name}] No emails found — skipping")
            return

        # 3. Pre-classify OLD_READ (deterministic, no AI cost)
        old_read_days = account_config.old_read_days or self.config.global_.old_read_days
        old_read_results, remaining_emails = self._pre_classify_old_read(
            emails, old_read_days
        )
        stats.pre_classified = len(old_read_results)
        logger.info(
            f"[{account_config.name}] "
            f"Pre-classified {len(old_read_results)} OLD_READ email(s) "
            f"(threshold: {old_read_days} days) — "
            f"{len(remaining_emails)} remaining for Claude"
        )

        # 4. Claude classification (in batches)
        batch_size = self.config.global_.batch_size
        claude_results: list[ClassificationResult] = []

        for i in range(0, len(remaining_emails), batch_size):
            batch = remaining_emails[i : i + batch_size]
            logger.info(
                f"[{account_config.name}] Classifying batch "
                f"{i // batch_size + 1}/{-(-len(remaining_emails) // batch_size)} "
                f"({len(batch)} email(s))…"
            )
            results = self.classifier.classify_batch(
                emails=batch,
                old_read_threshold_days=old_read_days,
                dry_run=self.dry_run,
            )
            claude_results.extend(results)

        stats.classified = len(claude_results)

        # 5. Execute deletes — batch mode for maximum speed
        all_results = old_read_results + claude_results

        to_delete_ids = [
            r.email_id for r in all_results
            if r.action_taken in ("pending_delete", "dry_run_would_delete")
        ]
        stats.kept   = sum(1 for r in all_results if r.action_taken == "kept")
        stats.errors += sum(1 for r in all_results if r.action_taken == "skipped_error")

        if to_delete_ids:
            if self.dry_run:
                stats.deleted = len(to_delete_ids)
                logger.info(
                    f"[{account_config.name}] [DRY RUN] Would delete "
                    f"{len(to_delete_ids)} email(s)"
                )
            elif hasattr(account, "batch_delete_emails"):
                # Fast path: one IMAP STORE + one EXPUNGE for all emails
                logger.info(
                    f"[{account_config.name}] Batch-deleting "
                    f"{len(to_delete_ids)} email(s)…"
                )
                deleted, errs = account.batch_delete_emails(to_delete_ids)
                stats.deleted  = deleted
                stats.errors  += errs
            else:
                # Fallback for Gmail API (no IMAP batch)
                for email_id in to_delete_ids:
                    if account.delete_email(email_id):
                        stats.deleted += 1
                    else:
                        stats.errors += 1

        # Log cache stats
        cache = self.classifier.get_cache_stats()
        logger.info(
            f"[{account_config.name}] === Done: "
            f"fetched={stats.fetched}, "
            f"deleted={'(dry-run) ' if self.dry_run else ''}{stats.deleted}, "
            f"kept={stats.kept}, "
            f"errors={stats.errors} "
            f"| Cache hit rate: {cache['cache_hit_rate_pct']}% ==="
        )

    # ------------------------------------------------------------------
    # Pre-classification (no Claude)
    # ------------------------------------------------------------------

    # Keywords that identify payslip / salary emails — never auto-delete these
    _PAYSLIP_KEYWORDS = (
        "payslip", "pay slip", "pay-slip",
        "salary", "salaris",
        "payroll", "pay roll",
        "pay stub", "paystub",
        "remuneration",
        "wage slip", "wageslip",
        "earnings statement",
    )

    @classmethod
    def _is_payslip(cls, email: Email) -> bool:
        """Return True if the email looks like a payslip/salary notification."""
        subject = (email.subject or "").lower()
        sender = (email.sender or "").lower()
        snippet = (email.snippet or "").lower()
        text = f"{subject} {sender} {snippet}"
        return any(kw in text for kw in cls._PAYSLIP_KEYWORDS)

    def _pre_classify_old_read(
        self, emails: list[Email], threshold_days: int
    ) -> tuple[list[ClassificationResult], list[Email]]:
        """
        Deterministically classify OLD_READ emails without calling Claude.

        An email is OLD_READ if:
        - is_read is True AND
        - age >= threshold_days AND
        - it is NOT a payslip/salary email (those are always kept)

        This saves Claude API calls for the most obvious category.
        """
        now = datetime.utcnow()
        pre_classified: list[ClassificationResult] = []
        remaining: list[Email] = []

        for email in emails:
            if not email.date:
                remaining.append(email)
                continue

            age_days = (now - email.date.replace(tzinfo=None)).days

            if email.is_read and age_days >= threshold_days:
                if self._is_payslip(email):
                    # Payslips are always kept — send to Claude just in case,
                    # but Claude's prompt also has a hard KEEP rule for them.
                    remaining.append(email)
                    logger.debug(
                        f"Payslip/salary email skipped from OLD_READ auto-delete: "
                        f"{email.id} | {email.subject!r}"
                    )
                else:
                    action = "dry_run_would_delete" if self.dry_run else "pending_delete"
                    pre_classified.append(
                        ClassificationResult(
                            email_id=email.id,
                            category=EmailCategory.OLD_READ,
                            confidence="high",
                            reasoning=(
                                f"Read email {age_days} days old "
                                f"(threshold: {threshold_days} days)"
                            ),
                            action_taken=action,
                        )
                    )
            else:
                remaining.append(email)

        return pre_classified, remaining

    # ------------------------------------------------------------------
    # Account factory
    # ------------------------------------------------------------------

    def _build_account(self, cfg: AccountConfig) -> Optional[BaseEmailAccount]:
        """Instantiate the correct account class from config."""
        if cfg.type == "gmail":
            return GmailAccount(
                account_name=cfg.name,
                email_address=cfg.email,
                token_file=cfg.token_file or f"tokens/token_{cfg.name}.json",
                credentials_file=cfg.credentials_file or "credentials.json",
                rate_limiter=self.rate_limiter,
            )
        elif cfg.type in ("yahoo", "imap", "outlook", "icloud", "aol", "zoho"):
            # "yahoo" kept for backwards compatibility — all IMAP-based providers
            # use the same ImapAccount class with auto-detected server settings.
            app_password = cfg.app_password or self.config.yahoo_app_password
            if not app_password:
                raise ValueError(
                    f"No app password set for {cfg.name} ({cfg.email}).\n"
                    "Add app_password to config.yaml or set YAHOO_APP_PASSWORD in .env.\n"
                    "Generate an App Password from your email provider's security settings."
                )
            return ImapAccount(
                account_name=cfg.name,
                email_address=cfg.email,
                app_password=app_password,
                rate_limiter=self.rate_limiter,
                imap_host=getattr(cfg, "imap_host", "") or "",
                imap_port=getattr(cfg, "imap_port", 993) or 993,
            )
        else:
            return None

    # ------------------------------------------------------------------
    # Rich output
    # ------------------------------------------------------------------

    def _print_summary(self, all_stats: list[RunStats]) -> None:
        """Print a Rich table summarising results across all accounts."""
        table = Table(
            title="\n📧 Email Cleaner — Summary",
            box=box.ROUNDED,
            show_header=True,
            header_style="bold cyan",
        )

        table.add_column("Account", style="white", no_wrap=True)
        table.add_column("Fetched", justify="right")
        table.add_column("Pre-classified", justify="right")
        table.add_column("AI classified", justify="right")
        table.add_column("Deleted", justify="right", style="red")
        table.add_column("Kept", justify="right", style="green")
        table.add_column("Errors", justify="right", style="yellow")
        table.add_column("Status", justify="center")

        total = RunStats(account="TOTAL")

        for s in all_stats:
            status = "✓" if not s.error_message else "✗"
            style = "" if not s.error_message else "red"

            table.add_row(
                s.account,
                str(s.fetched),
                str(s.pre_classified),
                str(s.classified),
                str(s.deleted),
                str(s.kept),
                str(s.errors),
                status,
                style=style,
            )

            total.fetched += s.fetched
            total.pre_classified += s.pre_classified
            total.classified += s.classified
            total.deleted += s.deleted
            total.kept += s.kept
            total.errors += s.errors

        table.add_section()
        table.add_row(
            "[bold]TOTAL[/bold]",
            f"[bold]{total.fetched}[/bold]",
            f"[bold]{total.pre_classified}[/bold]",
            f"[bold]{total.classified}[/bold]",
            f"[bold red]{total.deleted}[/bold red]",
            f"[bold green]{total.kept}[/bold green]",
            f"[bold yellow]{total.errors}[/bold yellow]",
            "",
        )

        self.console.print(table)

        # Cache stats
        cache = self.classifier.get_cache_stats()
        self.console.print(
            f"\n[dim]Claude API: {cache['api_calls']} call(s) | "
            f"Cache hit rate: {cache['cache_hit_rate_pct']}% | "
            f"Cache reads: {cache['cache_reads_tokens']:,} tokens[/dim]"
        )

        if self.dry_run:
            self.console.print(
                "\n[bold yellow]⚠  DRY RUN — No emails were actually deleted.[/bold yellow]"
            )
        else:
            self.console.print(
                f"\n[bold green]✓ Done! {total.deleted} email(s) permanently deleted.[/bold green]"
            )

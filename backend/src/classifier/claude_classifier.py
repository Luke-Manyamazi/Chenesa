"""
Claude AI email classifier with prompt caching and batch processing.

Caching strategy:
- CLASSIFICATION_SYSTEM_PROMPT (~500 tokens) is marked cache_control=ephemeral
- It is 100% static — no dynamic values, no timestamps, no per-account data
- First API call in a run: cache WRITE (1.25x cost)
- All subsequent calls within 5-minute window: cache HIT (~0.1x cost)
- On a 500-email run with batch_size=20 (25 calls): 1 write + 24 hits
  → system prompt tokens cost (1.25 + 24×0.1) / 25 ≈ 0.15x average vs 1x without caching
"""
import json
import re
from datetime import datetime
from typing import Optional

import anthropic
from loguru import logger
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.classifier.prompts import CLASSIFICATION_SYSTEM_PROMPT
from src.utils.models import (
    ClassificationResult,
    DELETE_CATEGORIES,
    Email,
    EmailCategory,
)
from src.utils.rate_limiter import RateLimiter


class ClaudeClassifier:
    """
    Classifies emails using Claude Haiku with prompt caching and batch processing.

    Each call to classify_batch() sends up to `batch_size` emails in a single
    API request, amortizing the system-prompt cache-write cost and reducing
    total API calls by up to 20x vs. one-email-per-call.
    """

    # Haiku 4.5 — fast, cheap, good at structured classification tasks.
    # Full dated ID used per user request; the alias "claude-haiku-4-5" also works.
    MODEL = "claude-haiku-4-5-20251001"

    # Classification responses are tiny JSON arrays — 512 tokens is generous.
    MAX_TOKENS = 512

    def __init__(self, api_key: str, rate_limiter: RateLimiter) -> None:
        self.client = anthropic.Anthropic(api_key=api_key)
        self.rate_limiter = rate_limiter

        # Cumulative cache stats across this classifier's lifetime
        self._total_cache_writes = 0
        self._total_cache_reads = 0
        self._total_api_calls = 0

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def classify_batch(
        self,
        emails: list[Email],
        old_read_threshold_days: int = 30,
        dry_run: bool = False,
    ) -> list[ClassificationResult]:
        """
        Classify a batch of emails in a single Claude API call.

        Args:
            emails: Emails to classify. Caller should split into chunks of ≤20.
            old_read_threshold_days: Delete read emails older than this many days.
            dry_run: If True, marks deletable emails as "dry_run_would_delete"
                     instead of "pending_delete".

        Returns:
            One ClassificationResult per email, in the same order as `emails`.
            Falls back to EmailCategory.UNKNOWN (safe — never deleted) on error.
        """
        if not emails:
            return []

        user_message = self._build_batch_message(emails, old_read_threshold_days)

        try:
            response = self._call_claude_with_retry(user_message)
        except Exception as exc:
            logger.error(
                f"Claude API call failed after all retries: {exc}. "
                f"Marking {len(emails)} email(s) as UNKNOWN (will not be deleted)."
            )
            return self._build_error_results(emails)

        return self._parse_response(response, emails, dry_run)

    def get_cache_stats(self) -> dict:
        """Return cumulative cache hit/miss statistics."""
        total_cache = self._total_cache_writes + self._total_cache_reads
        hit_rate = (
            (self._total_cache_reads / total_cache * 100) if total_cache > 0 else 0.0
        )
        return {
            "api_calls": self._total_api_calls,
            "cache_writes_tokens": self._total_cache_writes,
            "cache_reads_tokens": self._total_cache_reads,
            "cache_hit_rate_pct": round(hit_rate, 1),
        }

    # ------------------------------------------------------------------
    # API call (with prompt caching + tenacity retries)
    # ------------------------------------------------------------------

    @retry(
        retry=retry_if_exception_type(
            (anthropic.RateLimitError, anthropic.InternalServerError)
        ),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(4),
        reraise=True,
    )
    def _call_claude_with_retry(self, user_message: str) -> anthropic.types.Message:
        """
        Call the Claude API with:
        - System prompt caching (cache_control=ephemeral on CLASSIFICATION_SYSTEM_PROMPT)
        - Tenacity retry on 429 (RateLimitError) and 5xx (InternalServerError)
        - Rate limiting via the shared RateLimiter token bucket

        NOTE: BadRequestError (400) is NOT retried — that indicates a code bug
        (malformed request, invalid parameter) and retrying would just fail again.
        """
        self.rate_limiter.acquire("anthropic")
        self._total_api_calls += 1

        response = self.client.messages.create(
            model=self.MODEL,
            max_tokens=self.MAX_TOKENS,
            # PROMPT CACHING:
            # The system block is the largest, most stable part of every request.
            # cache_control=ephemeral tells Anthropic to cache this exact prefix.
            #
            # Render order is: tools → system → messages
            # Since we have no tools, the cache key covers CLASSIFICATION_SYSTEM_PROMPT.
            #
            # Silent invalidator prevention:
            #   - CLASSIFICATION_SYSTEM_PROMPT is a module-level constant (never mutated)
            #   - No datetime, UUID, or per-account data flows into it
            #   - Dynamic context (date, threshold, emails) goes in the user message only
            system=[
                {
                    "type": "text",
                    "text": CLASSIFICATION_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {"role": "user", "content": user_message}
            ],
        )

        self._log_cache_usage(response.usage)
        return response

    def _log_cache_usage(self, usage: anthropic.types.Usage) -> None:
        """Log cache hit/miss info and update running totals."""
        cache_writes = getattr(usage, "cache_creation_input_tokens", 0) or 0
        cache_reads = getattr(usage, "cache_read_input_tokens", 0) or 0
        uncached = usage.input_tokens or 0
        output = usage.output_tokens or 0

        self._total_cache_writes += cache_writes
        self._total_cache_reads += cache_reads

        call_num = self._total_api_calls  # already incremented before the call

        if cache_reads > 0:
            logger.debug(
                f"[Claude call #{call_num}] CACHE HIT ✓ — "
                f"cache_read={cache_reads} tokens (~0.1× cost), "
                f"cache_write={cache_writes}, uncached={uncached}, output={output}"
            )
        elif cache_writes > 0:
            logger.debug(
                f"[Claude call #{call_num}] CACHE WRITE — "
                f"written={cache_writes} tokens (~1.25× cost), "
                f"uncached={uncached}, output={output}"
            )
        else:
            logger.debug(
                f"[Claude call #{call_num}] NO CACHE — "
                f"input={uncached}, output={output} "
                f"(prefix too short or cache miss)"
            )

    # ------------------------------------------------------------------
    # Message building
    # ------------------------------------------------------------------

    def _build_batch_message(
        self, emails: list[Email], old_read_threshold_days: int
    ) -> str:
        """
        Build a single user message listing all emails for classification.

        Dynamic context (date, threshold) goes here — NOT in the system prompt —
        so the system prompt stays static and its cache remains valid.
        """
        now = datetime.utcnow()
        lines: list[str] = [
            f"Today's date: {now.date()}",
            f"Old-read threshold: {old_read_threshold_days} days "
            f"(emails READ and older than this → OLD_READ category)",
            "",
            f"Classify the {len(emails)} email(s) below.",
            "Respond ONLY with a JSON array — one object per email in the same order.",
            "",
        ]

        for i, email in enumerate(emails, 1):
            if email.date:
                age_days = (now - email.date.replace(tzinfo=None)).days
                date_str = str(email.date.date())
            else:
                age_days = 0
                date_str = "unknown"

            read_status = "READ" if email.is_read else "UNREAD"
            preview = (email.snippet or "")[:200].strip() or "(no preview)"

            lines += [
                f"--- Email {i} ---",
                f"From: {email.sender or '(unknown)'}",
                f"Subject: {email.subject or '(no subject)'}",
                f"Date: {date_str} ({age_days} days ago, {read_status})",
                f"Preview: {preview}",
                "",
            ]

        lines.append(
            "Required JSON format:\n"
            '[{"email_num": 1, "category": "SPAM|MARKETING|SOCIAL|OLD_READ|KEEP", '
            '"confidence": "high|medium|low", "reasoning": "one sentence"}, ...]'
        )

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_response(
        self,
        response: anthropic.types.Message,
        emails: list[Email],
        dry_run: bool,
    ) -> list[ClassificationResult]:
        """
        Parse Claude's JSON array response into ClassificationResult objects.

        On any parsing failure, falls back to UNKNOWN (safe — never deleted).
        """
        # Extract text block from response
        raw_text = ""
        for block in response.content:
            if hasattr(block, "type") and block.type == "text":
                raw_text = block.text
                break

        if not raw_text.strip():
            logger.warning("Claude returned empty content — all emails marked UNKNOWN")
            return self._build_error_results(emails)

        # Strip markdown code fences Claude occasionally adds
        clean = raw_text.strip()
        clean = re.sub(r"^```(?:json)?\s*\n?", "", clean)
        clean = re.sub(r"\n?\s*```$", "", clean)
        clean = clean.strip()

        try:
            parsed = json.loads(clean)
        except json.JSONDecodeError as exc:
            logger.warning(
                f"Failed to parse Claude response as JSON: {exc}\n"
                f"First 400 chars: {raw_text[:400]!r}"
            )
            return self._build_error_results(emails)

        # Normalize to list (handle single-dict responses)
        if isinstance(parsed, dict):
            parsed = [parsed]
        elif not isinstance(parsed, list):
            logger.warning(
                f"Unexpected Claude response type {type(parsed).__name__} — "
                "all emails marked UNKNOWN"
            )
            return self._build_error_results(emails)

        results: list[ClassificationResult] = []

        for i, email in enumerate(emails):
            if i < len(parsed):
                item = parsed[i]
                category = self._parse_category(item.get("category", ""))
                confidence = str(item.get("confidence", "low")).lower()
                reasoning = str(item.get("reasoning", "")).strip()
                action = self._determine_action(category, dry_run)

                results.append(
                    ClassificationResult(
                        email_id=email.id,
                        category=category,
                        confidence=confidence,
                        reasoning=reasoning,
                        action_taken=action,
                    )
                )
            else:
                # Claude returned fewer items than emails sent — shouldn't happen,
                # but be defensive rather than crashing.
                logger.warning(
                    f"Claude returned {len(parsed)} classification(s) "
                    f"for {len(emails)} email(s) — "
                    f"email #{i + 1} (id={email.id!r}) missing from response"
                )
                results.append(
                    ClassificationResult(
                        email_id=email.id,
                        category=EmailCategory.UNKNOWN,
                        confidence="low",
                        reasoning="Missing from Claude batch response",
                        action_taken="skipped_error",
                    )
                )

        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_category(raw: str) -> EmailCategory:
        """Map a raw category string to EmailCategory, defaulting to UNKNOWN."""
        try:
            return EmailCategory(raw.strip().upper())
        except ValueError:
            if raw:
                logger.debug(f"Unrecognised category from Claude: {raw!r} → UNKNOWN")
            return EmailCategory.UNKNOWN

    @staticmethod
    def _determine_action(category: EmailCategory, dry_run: bool) -> str:
        """Map a category to the action string recorded in ClassificationResult."""
        if category in DELETE_CATEGORIES:
            return "dry_run_would_delete" if dry_run else "pending_delete"
        if category == EmailCategory.UNKNOWN:
            return "skipped_error"
        return "kept"

    def _build_error_results(self, emails: list[Email]) -> list[ClassificationResult]:
        """
        Build safe UNKNOWN results for every email in the batch.
        UNKNOWN is never deleted — it's the safe fallback for any error condition.
        """
        return [
            ClassificationResult(
                email_id=email.id,
                category=EmailCategory.UNKNOWN,
                confidence="low",
                reasoning="Classification failed — API or parse error; skipped for safety",
                action_taken="skipped_error",
            )
            for email in emails
        ]

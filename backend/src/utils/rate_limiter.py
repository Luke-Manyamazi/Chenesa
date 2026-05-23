"""
Token-bucket rate limiter for Gmail and Anthropic APIs.
"""
import threading
import time
from dataclasses import dataclass, field


@dataclass
class TokenBucket:
    """Thread-safe token bucket for rate limiting."""
    capacity: float        # Max tokens in bucket
    refill_rate: float     # Tokens added per second

    tokens: float = field(init=False)
    last_refill: float = field(init=False)
    _lock: threading.Lock = field(init=False)

    def __post_init__(self):
        self.tokens = self.capacity
        self.last_refill = time.monotonic()
        self._lock = threading.Lock()

    def acquire(self, cost: float = 1.0) -> None:
        """Block until `cost` tokens are available, then consume them."""
        with self._lock:
            self._refill()
            while self.tokens < cost:
                deficit = cost - self.tokens
                sleep_time = deficit / self.refill_rate
                self._lock.release()
                time.sleep(sleep_time)
                self._lock.acquire()
                self._refill()
            self.tokens -= cost

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now


class RateLimiter:
    """
    Manages independent rate limits for Gmail and Anthropic APIs.

    Gmail:    requests per second (default: 5 rps — well within 250 units/sec quota)
    Anthropic: requests per minute for Haiku (default: 50 rpm)
    """

    def __init__(self, gmail_rps: float = 5.0, anthropic_rpm: float = 50.0):
        self._buckets = {
            "gmail": TokenBucket(
                capacity=gmail_rps,
                refill_rate=gmail_rps,
            ),
            "anthropic": TokenBucket(
                capacity=max(1.0, anthropic_rpm / 60),  # burst: 1 request
                refill_rate=anthropic_rpm / 60,         # tokens/second
            ),
        }

    def acquire(self, api: str, cost: float = 1.0) -> None:
        """Block until the named API bucket has capacity."""
        if api not in self._buckets:
            raise ValueError(f"Unknown API: {api!r}. Valid: {list(self._buckets)}")
        self._buckets[api].acquire(cost)

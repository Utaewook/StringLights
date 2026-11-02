"""Structured log line and queue counter for the surgery endpoint.

Each surgery request writes one line: `event=surgery key=value ...`. The line
holds only coarse buckets and timings. It never holds a file name, an operator
type, a tensor name, or a client address.
"""

import asyncio
import logging
import sys
import time
from datetime import datetime, timezone

OUTCOMES = frozenset(
    {"ok", "rejected", "timeout", "failed", "bad_zip", "too_large", "abandoned"}
)

# One handler of our own: uvicorn does not configure the root logger, so an
# INFO record from a plain module logger would otherwise be dropped.
logger = logging.getLogger("app.metrics")
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stderr)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

_MB = 1024 * 1024


def upload_mb_bucket(size_bytes: int | None) -> str:
    if size_bytes is None:
        return "unknown"
    mb = size_bytes / _MB
    for upper, label in ((1, "<1"), (5, "1-5"), (10, "5-10"), (25, "10-25"), (50, "25-50")):
        if mb < upper:
            return label
    return ">=50"


def node_count_bucket(count: int | None) -> str:
    if count is None:
        return "unknown"
    for upper, label in ((10, "<10"), (50, "10-49"), (200, "50-199"), (1000, "200-999")):
        if count < upper:
            return label
    return ">=1000"


class QueueCounter:
    """Counts requests that wait for the semaphore.

    `waiting` rises before the request asks for the semaphore and falls when it
    holds the semaphore, or when the wait ends by cancellation or exception.
    """

    def __init__(self) -> None:
        self.waiting = 0

    def depth_on_arrival(self, semaphore: asyncio.Semaphore) -> int:
        """Requests ahead of a new arrival: those waiting, plus the one running."""
        return self.waiting + (1 if semaphore.locked() else 0)

    async def acquire(self, semaphore: asyncio.Semaphore) -> None:
        self.waiting += 1
        try:
            await semaphore.acquire()
        finally:
            self.waiting -= 1


class SurgeryLog:
    """Timing and outcome of one request. Call `emit` once."""

    def __init__(self, upload_bytes: int | None = None, queue_depth: int = 0) -> None:
        self.start = time.monotonic()
        self.upload_bytes = upload_bytes
        self.queue_depth = queue_depth
        self.queue_wait_ms = 0
        self.surgery_ms = 0
        self.node_count: int | None = None
        self._wait_start: float | None = None
        self._surgery_start: float | None = None
        self.emitted = False

    def wait_started(self) -> None:
        self._wait_start = time.monotonic()

    def wait_ended(self) -> None:
        if self._wait_start is not None:
            self.queue_wait_ms = _ms(self._wait_start)
            self._wait_start = None

    def surgery_started(self) -> None:
        self._surgery_start = time.monotonic()

    def surgery_ended(self) -> None:
        if self._surgery_start is not None:
            self.surgery_ms = _ms(self._surgery_start)
            self._surgery_start = None

    def emit(self, outcome: str, status: int) -> None:
        if self.emitted:
            return
        self.emitted = True
        # A cancel can land mid-wait or mid-surgery; close open timers.
        self.wait_ended()
        self.surgery_ended()
        if outcome not in OUTCOMES:
            outcome = "failed"
        logger.info(
            "event=surgery ts=%s outcome=%s status=%d upload_mb_bucket=%s "
            "queue_depth_on_arrival=%d queue_wait_ms=%d surgery_ms=%d "
            "total_ms=%d node_count_bucket=%s",
            datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            outcome,
            status,
            upload_mb_bucket(self.upload_bytes),
            self.queue_depth,
            self.queue_wait_ms,
            self.surgery_ms,
            _ms(self.start),
            node_count_bucket(self.node_count),
        )


def _ms(since: float) -> int:
    return int((time.monotonic() - since) * 1000)

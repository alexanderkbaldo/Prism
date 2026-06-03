"""A tiny per-key circuit breaker.

Used to protect the scoring path from a model whose key is throttled or out of
quota: after a run of consecutive failures the breaker "opens" and short-circuits
further calls for a cooldown window, so a dead key can't stall ingestion behind
SDK retries. A single success resets the failure count.

Single-process workers call this from one thread, so no locking is needed.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass
class _State:
    failures: int = 0
    open_until: float = 0.0  # monotonic seconds; 0 = closed


class CircuitBreaker:
    def __init__(self, threshold: int, cooldown_seconds: float,
                 clock=time.monotonic) -> None:
        self.threshold = threshold
        self.cooldown = cooldown_seconds
        self._clock = clock
        self._state: dict[str, _State] = {}

    def allow(self, name: str) -> bool:
        """True if calls to `name` are currently permitted."""
        st = self._state.get(name)
        return not (st and st.open_until > self._clock())

    def record_success(self, name: str) -> None:
        self._state[name] = _State()  # reset

    def record_failure(self, name: str) -> None:
        st = self._state.setdefault(name, _State())
        st.failures += 1
        if st.failures >= self.threshold and st.open_until <= self._clock():
            st.open_until = self._clock() + self.cooldown
            log.warning(
                "circuit breaker OPEN for %s after %d consecutive failures; "
                "pausing calls for %ss", name, st.failures, self.cooldown
            )

    def status(self, name: str) -> str:
        return "open" if not self.allow(name) else "closed"

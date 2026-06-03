"""Background multi-model scoring worker.

Decouples LLM scoring from the ingestion hot path. The normaliser writes signals
immediately (fast drain); this long-lived worker polls for unscored, text-bearing
signals and scores them in batches via `scoring.score()`, which is guarded by a
per-model circuit breaker. A throttled or out-of-quota key therefore can't stall
ingestion — it just pauses that model's scoring until it recovers.

Run as its own service (see docker-compose `scorer`). No-op unless
`scoring_mode == "worker"` and at least one model key is configured.
"""
from __future__ import annotations

import logging
import signal as signal_module
import time

from prism.ai import scoring
from prism.common.config import settings
from prism.common.db import unscored_signals

log = logging.getLogger(__name__)


class Scorer:
    def __init__(self) -> None:
        self._running = True

    def stop(self, *_args) -> None:
        log.info("shutdown requested")
        self._running = False

    def _idle(self) -> None:
        # Sleep in short slices so SIGTERM is honoured promptly.
        for _ in range(max(1, settings.scorer_idle_seconds)):
            if not self._running:
                return
            time.sleep(1)

    def run_once(self) -> int:
        """Score one batch of unscored signals. Returns the number scored."""
        rows = unscored_signals(
            sorted(scoring.SCORABLE_CATEGORIES), settings.scorer_batch_size
        )
        if not rows:
            return 0
        scored = 0
        for row in rows:
            if not self._running:
                break
            try:
                if scoring.score(row["id"], row["category"], row["summary_text"]):
                    scored += 1
            except Exception:  # noqa: BLE001 - one bad signal can't kill the loop
                log.exception("scoring failed for signal %s", row["id"])
        log.info("scored %d/%d signals this batch", scored, len(rows))
        return scored

    def run(self) -> None:
        signal_module.signal(signal_module.SIGINT, self.stop)
        signal_module.signal(signal_module.SIGTERM, self.stop)
        log.info("scorer started (mode=%s, batch=%d)",
                 settings.scoring_mode, settings.scorer_batch_size)

        while self._running:
            if settings.scoring_mode != "worker" or not scoring.enabled():
                self._idle()
                continue
            try:
                scored = self.run_once()
            except Exception:  # noqa: BLE001 - keep the worker alive on blips
                log.exception("scorer batch failed; backing off")
                self._idle()
                continue
            # Nothing to do (queue empty, or all models' breakers open) -> idle
            # so we don't hot-loop the database.
            if scored == 0:
                self._idle()

        log.info("scorer stopped")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    Scorer().run()


if __name__ == "__main__":
    main()

"""Apply the schema to the configured database.

`sql/init.sql` is fully idempotent (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT
EXISTS), so it doubles as the migration script: running it against a populated
database upgrades it — adding the Phase 2 `company_briefs` table and the
`model_scores` / `summary_text` columns — without dropping or rewriting existing
rows. The Docker entrypoint runs init.sql only on a fresh volume, so this is how
an already-running deployment picks up the changes:

    python -m prism.common.migrate
"""
from __future__ import annotations

import logging
from pathlib import Path

from prism.common.db import get_cursor

log = logging.getLogger(__name__)

SQL_PATH = Path(__file__).resolve().parents[2] / "sql" / "init.sql"


def run() -> None:
    sql = SQL_PATH.read_text(encoding="utf-8")
    with get_cursor(commit=True) as cur:
        cur.execute(sql)
    log.info("applied schema from %s", SQL_PATH)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    run()
    print("migration complete")


if __name__ == "__main__":
    main()

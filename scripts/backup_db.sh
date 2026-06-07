#!/usr/bin/env bash
#
# Back up the Prism Postgres database to a timestamped, gzipped SQL dump under
# ./backups, and prune old dumps (keeps the newest $KEEP, default 14).
#
# Usage:   ./scripts/backup_db.sh            # run from anywhere
#          KEEP=30 ./scripts/backup_db.sh    # keep more history
#
# Restore: gzip -dc backups/prism-YYYYMMDD-HHMMSS.sql.gz \
#            | docker compose exec -T postgres psql -U prism -d prism
#
# Schedule (macOS/Linux cron — daily at 02:00):
#   0 2 * * * cd /Users/blake/Prism && ./scripts/backup_db.sh >> backups/cron.log 2>&1
set -euo pipefail

KEEP="${KEEP:-14}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/prism-$STAMP.sql.gz"

echo "Backing up Prism Postgres → $FILE"
docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
  pg_dump -U prism -d prism | gzip >"$FILE"

# Guard against a near-empty dump (e.g. Postgres was down) — don't keep a dud.
SIZE="$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE")"
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: backup is only ${SIZE} bytes — is the postgres container up? Removing." >&2
  rm -f "$FILE"
  exit 1
fi
echo "OK — $(du -h "$FILE" | cut -f1)"

# Prune everything older than the newest $KEEP (portable: no xargs -r).
ls -1t "$BACKUP_DIR"/prism-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
  rm -f "$old"
done
echo "Retained $(ls -1 "$BACKUP_DIR"/prism-*.sql.gz 2>/dev/null | wc -l | tr -d ' ') backup(s) (keep=$KEEP)."

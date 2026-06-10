#!/usr/bin/env bash
#
# Seed a REMOTE Postgres (e.g. Railway) from a local Prism backup dump — the
# "snapshot deploy" step: load a frozen copy of your data into the cloud
# database the deployed API reads from.
#
# Usage:
#   ./scripts/seed_remote.sh <backup.sql.gz> '<TARGET_DATABASE_URL>'
#   ./scripts/seed_remote.sh --reset backups/prism-20260610-120000.sql.gz "$RAILWAY_DB_URL"
#
# TARGET_DATABASE_URL: Railway dashboard → Postgres → Connect → "Postgres
# Connection URL" (postgresql://user:pass@host:port/db). Can also be passed via
# the TARGET_DATABASE_URL env var instead of the 2nd argument.
#
# Flags:
#   --reset        Wipe the target's public schema before loading (DROP SCHEMA
#                  public CASCADE). Recommended — guarantees a clean load whether
#                  the DB is empty, already-migrated, or being re-seeded.
#   --allow-local  Permit a localhost target (refused by default, so you can't
#                  nuke your dev DB by mistake).
#
# Safety: prints the target host/db (credentials stripped) and requires you to
# type "yes" before doing anything.
#
# Requires psql + gunzip locally. Install psql on macOS:
#   brew install libpq && brew link --force libpq
set -euo pipefail

RESET=0
ALLOW_LOCAL=0
POSITIONAL=()
for a in "$@"; do
  case "$a" in
    --reset) RESET=1 ;;
    --allow-local) ALLOW_LOCAL=1 ;;
    -*) echo "Unknown flag: $a" >&2; exit 1 ;;
    *) POSITIONAL+=("$a") ;;
  esac
done

FILE="${POSITIONAL[0]:-}"
TARGET="${POSITIONAL[1]:-${TARGET_DATABASE_URL:-}}"

if [ -z "$FILE" ] || [ -z "$TARGET" ]; then
  echo "Usage: $0 [--reset] [--allow-local] <backup.sql.gz> '<TARGET_DATABASE_URL>'" >&2
  exit 1
fi
[ -f "$FILE" ] || { echo "ERROR: backup file not found: $FILE" >&2; exit 1; }
command -v psql >/dev/null || {
  echo "ERROR: psql not found. macOS: brew install libpq && brew link --force libpq" >&2
  exit 1
}

# Strip credentials for display; pull the host out for the localhost guard.
SAFE="$(printf '%s' "$TARGET" | sed -E 's#//[^@]*@#//#')"
HOST="$(printf '%s' "$TARGET" | sed -E 's#.*@([^/:]+).*#\1#')"
if printf '%s' "$HOST" | grep -qiE '^(localhost|127\.0\.0\.1)$' && [ "$ALLOW_LOCAL" -ne 1 ]; then
  echo "Refusing to seed a LOCAL database ($HOST). Pass --allow-local to override." >&2
  exit 1
fi

echo "About to seed:"
echo "  dump:   $FILE ($(du -h "$FILE" | cut -f1))"
echo "  target: $SAFE"
[ "$RESET" -eq 1 ] && echo "  mode:   --reset (DROP SCHEMA public CASCADE first — wipes the target)"
echo
read -r -p "Type 'yes' to proceed: " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

if [ "$RESET" -eq 1 ]; then
  echo "Resetting public schema…"
  psql "$TARGET" -v ON_ERROR_STOP=1 -q \
    -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
fi

echo "Loading dump…"
# ON_ERROR_STOP off: a non-reset load into an already-migrated DB emits harmless
# "already exists" notices we don't want to abort on.
gzip -dc "$FILE" | psql "$TARGET" -v ON_ERROR_STOP=0 -q

echo
echo "Row counts on target:"
for t in signals alerts company_briefs raw_events; do
  n="$(psql "$TARGET" -At -c "SELECT count(*) FROM $t;" 2>/dev/null || echo '?')"
  echo "  $t = $n"
done
echo "Done."

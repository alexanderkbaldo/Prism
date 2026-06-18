#!/usr/bin/env sh
# API entrypoint for Railway: run idempotent migrations, then exec the web server.
#
# Why a script instead of a "migrate && uvicorn ..." one-liner: Railway may run
# the start command WITHOUT a shell (exec form), which turns "&&" into a literal
# argument to `python -m prism.common.migrate` (it ignores extra argv), so the
# migration runs, exits 0, and uvicorn is never invoked — exactly the
# "migration complete, no server" symptom. Invoking this file via `sh` guarantees
# a real shell sequences the two steps.
#
# `exec` replaces this shell with uvicorn so it becomes PID 1 and receives
# Railway's stop/restart signals directly. Bind to 0.0.0.0 (IPv4): this Railway
# service's healthcheck connects over IPv4, and an IPv6-only `::` bind fails it
# even though uvicorn is up. PORT is provided by Railway (falls back to 8000).
set -e

python -m prism.common.migrate
exec uvicorn prism.api.main:app --host 0.0.0.0 --port "${PORT:-8000}"

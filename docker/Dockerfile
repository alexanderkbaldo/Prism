# Single image shared by every Prism service; the compose `command` selects
# which entrypoint runs (normaliser, a scraper, or the Prefect server/worker).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY pyproject.toml ./
COPY prism ./prism
RUN pip install -e .

# SQL schema/migrations — read at runtime by `python -m prism.common.migrate`
# (which resolves /app/sql/init.sql). Copied after the install so schema edits
# don't bust the dependency layer cache.
COPY sql ./sql

# Default command; overridden per-service in docker-compose.yml.
CMD ["python", "-m", "prism.normaliser.worker"]

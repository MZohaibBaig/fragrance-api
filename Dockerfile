# ── Stage 1: build dependencies ──────────────────────────────────────────────
FROM python:3.13.9-slim AS builder

WORKDIR /app

# Install build tools needed by psycopg2-binary wheel compilation (if any)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: production image ────────────────────────────────────────────────
FROM python:3.13.9-slim AS final

# Copy installed packages from builder so the final image has no build tools
COPY --from=builder /install /usr/local

WORKDIR /app

# Create a non-root user and own the working directory
RUN useradd --no-create-home --no-log-init --system appuser \
    && chown appuser /app

# Copy application code (everything not excluded by .dockerignore)
COPY --chown=appuser . .

USER appuser

# collectstatic needs no database, only a SECRET_KEY to import settings. Run it at build
# time with a throwaway key scoped to this one command (not an ENV, so it never reaches
# the runtime image), which keeps container start fast when the service wakes from sleep.
RUN SECRET_KEY=build-time-collectstatic-only python manage.py collectstatic --noinput

# Expose the default port; the real port is controlled by $PORT at runtime
EXPOSE 8000

# Entrypoint: reproduce the Procfile sequence exactly.
# migrate runs at container start because it needs the live database.
CMD sh -c "\
    python manage.py migrate --noinput && \
    exec gunicorn core.wsgi --bind 0.0.0.0:${PORT:-8000}"

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

# Expose the default port; the real port is controlled by $PORT at runtime
EXPOSE 8000

# Entrypoint: reproduce the Procfile sequence exactly.
# migrate and collectstatic run at container start (not build time) because
# they both need a live database / SECRET_KEY from the runtime environment.
CMD sh -c "\
    python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    exec gunicorn core.wsgi --bind 0.0.0.0:${PORT:-8000}"

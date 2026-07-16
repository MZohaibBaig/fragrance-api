# E2E tests (local only)

A single Playwright spec (`happy-path.spec.ts`) that drives the full flow through a real
browser: register a throwaway user via the API → log in → create an ingredient → create a
recipe with it → add a batch → verify the frozen aromatic/diluent grams on the batch detail
page → add a note → verify it shows "Day 0".

Not wired into CI — it needs a live Postgres database and both servers running, which CI
doesn't provision. Run it locally instead.

## Prerequisites

From the repo root, in two separate terminals:

```bash
# Terminal 1 — Django on :8000
python manage.py runserver

# Terminal 2 — Vite dev server on :5173
cd frontend
npm run dev
```

## Run

```bash
cd frontend
npx playwright install --with-deps chromium   # first time only
npx playwright test
```

## Configuration

The spec defaults to `http://localhost:5173` (frontend, matching Vite's default bind) and
`http://127.0.0.1:8000/api` (backend). Override with env vars if your servers run elsewhere:

```bash
E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://127.0.0.1:8000/api npx playwright test
```

Each run registers a fresh throwaway user (`e2e_<timestamp>`) against `/api/register/`, so
the spec is safe to re-run without cleanup.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Fragrance Lab: a Django REST API for DIY perfumery (recipes → weighed batches → dated smell-test notes), plus a React/Vite frontend in `frontend/`. Backend apps: `core/` (settings, root urls, health/wsgi) and `formulations/` (all domain code: models, serializers, views, filters, permissions, `ai.py`, tests in a single `tests.py`).

## Commands

Backend (Python 3.13, PostgreSQL required — tests run against a real Postgres test DB, not SQLite):

```
pip install -r requirements-dev.txt        # dev deps (ruff etc.); requirements.txt is runtime only
cp .env.example .env                       # then fill in SECRET_KEY / DB_*; set DEBUG=True for local dev
python manage.py migrate
python manage.py runserver
python manage.py test                                          # full suite
python manage.py test formulations.tests.<TestClass>.<test_method>   # single test
python manage.py seed_demo                                     # idempotent demo data (see README for args)
ruff check . && ruff format --check .      # CI lint gate; pre-commit runs ruff --fix + ruff-format
```

Frontend (`cd frontend`, Node 20): `npm ci`, `npm run dev`, `npx tsc -b`, `npm run build`, `npm run test` (vitest), `npm run lint` (oxlint), `npm run gen:types` (regenerates `src/api/types.ts` from the running backend's `/api/schema/`). Playwright e2e specs live in `frontend/e2e`.

CI (`.github/workflows/tests.yml`) runs three jobs: ruff lint/format, Django tests against a postgres:16 service (with `SECURE_SSL_REDIRECT=False`), and frontend typecheck/build/vitest.

Style: ruff, line length 119, **single quotes**, migrations excluded.

## Configuration

- `DEBUG` defaults to False; with DEBUG False, `SECRET_KEY` is mandatory (raises `ImproperlyConfigured`). Security headers/secure cookies/SSL redirect are inert under `DEBUG=True`. `SECURE_SSL_REDIRECT` has its own env var so CI (DEBUG False, plain HTTP) can disable it.
- DB: `DATABASE_URL` (via dj_database_url) takes precedence, otherwise `DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT`.
- `GROQ_API_KEY` / `GROQ_MODEL` for AI note summarization (`formulations/ai.py`, called server-side with httpx, rate-limited 20/hour/user, mocked in tests).
- Deploy: `Procfile` (Railway: migrate → collectstatic → gunicorn on `$PORT`) and a `Dockerfile` that mirrors it. Static files served by WhiteNoise. Frontend deploys to Vercel; see `DEPLOY.md` for env vars.

## Architecture / domain rules that span files

- **Weight-native (w/w), grams only.** No volume in the math. `Ingredient.density_g_per_ml` is display-only; `dilution_strength` is reserved/unused.
- **Two percentage levels:** `Recipe.default_concentration` = aromatic share of the finished perfume; `RecipeIngredient.proportion` = share within the aromatic phase (meant to sum to 100, never enforced). The diluent is never an ingredient row: `diluent_g = batch_size_g - aromatic_g` (subtraction, so parts sum exactly).
- **Batches freeze their math.** `Batch.compute()` (`formulations/models.py`) snapshots `aromatic_g`, `diluent_g`, `recipe_was_balanced` and creates `BatchIngredient` rows at mix time. These are read-only in the API; editing a recipe later must not alter existing batches. Full precision stored, rounded to 0.01 g for display.
- **`on_delete=PROTECT`** on `Batch.recipe`, `RecipeIngredient.ingredient`, `BatchIngredient.ingredient` — deliberate, don't change to CASCADE. Viewsets handle the resulting protected errors (see `IngredientViewSet.destroy`).
- **Maceration fields** (`is_due`, `days_remaining`, `ready_on`, `maceration_progress`, …) are computed on read; `status` never auto-changes.
- **Owner isolation:** every viewset filters in `get_queryset` (cross-user access must 404, not 403), and every serializer FK to an owned object (`recipe`, `ingredient`, `batch`) restricts its queryset to the requesting user. Preserve both when adding endpoints/fields.
- Auth is JWT (simplejwt); token endpoints are throttled. API docs via drf-spectacular at `/api/docs/` and `/api/schema/`.
- Frontend (`frontend/src`): axios client + per-resource modules in `src/api/`, TanStack Query, React Router, Tailwind 4; `types.ts` is generated from the OpenAPI schema.

# Working agreement

## 1. Think before coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, ask rather than guess.
- Present multiple interpretations when genuinely ambiguous — don't silently pick one.
- Push back if a simpler approach exists.
- Stop when confused. Name what's unclear and ask.
- If a file or path I referenced doesn't exist, say so and stop — do not create it to make the instruction work.

## 2. Simplicity first
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or configurability that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

Test: would a senior engineer call this overcomplicated? If yes, simplify.

## 3. Surgical changes
Touch only what you must.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor what isn't broken.
- Match existing style even if you'd do it differently.
- Notice unrelated dead code? Mention it. Don't delete it.
- Remove imports/variables that YOUR change orphaned. Nothing else.

Test: every changed line traces directly to the request.

## 4. Goal-driven execution
Define success criteria, then loop until verified.
- "Add validation" → "write tests for invalid inputs, then make them pass"
- "Fix the bug" → "write a test reproducing it, then make it pass"
- For multi-step work, state the plan as: step → verify: check

## 5. Verify, don't claim
Never report success without running something that proves it.
- Report real command output, not what you expect the output to be.
- A build that "should work" isn't verified. Build it.
- If you can't verify something (no API key, no network, no test suite), say so plainly rather than implying it passed.
- If you measure something, say what you measured and when — stale measurements have caused real confusion here.

## Project conventions

**Environment**
- Windows. Terminal commands must be PowerShell, not bash.
- Python: use `py -3.13`. Bare `python` resolves to 3.8 on this machine and can't install pinned requirements.
- Working venv is `venv/`. `.venv/` is gitignored.

**Git**
- Never commit or push unless explicitly asked. Default to leaving changes staged or unstaged for review.
- Branch off `main`, commit, push, open PR, wait for green checks, merge, pull. `main` is protected.
- Before staging: check `git status`. Generated directories (`staticfiles/`, `.venv/`, build output) have been accidentally staged twice. Don't let it happen again.

**Docker**
- Tail long build output (`| Select-Object -Last 60`), don't dump it in full.
- When checking an image, verify you're looking at the tag you just built — stale tags from earlier builds have caused wrong conclusions here.
- These apps bind `0.0.0.0` on `$PORT` with a fallback. Don't hardcode ports.

**Deployment context**
- Three projects deploy to Railway sharing one PostgreSQL instance, each with its own database.
- PG18 volumes mount at `/var/lib/postgresql`, NOT `/var/lib/postgresql/data`. This exact mistake silently broke persistence once.

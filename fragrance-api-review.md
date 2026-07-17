# fragrance-api — Candid Review

*Reviewed 2026-07-17. Repo: [github.com/MZohaibBaig/fragrance-api](https://github.com/MZohaibBaig/fragrance-api) · Live: fragrance-api-eight.vercel.app · API: web-production-265e0.up.railway.app/api/docs/*

## Verdict

**Yes, interview this person — and don't treat them as junior on paper alone.** The code, the domain-modeling writeup, and the working live demo are meaningfully above the median "todo app with auth" portfolio project. A senior engineer would trust this code in a real codebase with normal review, not because it's flawless, but because the *reasoning* behind non-obvious decisions (why w/w not v/v, why `PROTECT` not `CASCADE`, why snapshots not versioning) is spelled out and each one is defensible. The label "junior" undersells what's here — this reads like someone at the top of junior / bottom of mid-level, self-taught or early-career, who has been deliberately practicing production habits (transactions, throttling, ownership isolation, CI) rather than just shipping features.

## First-Impression Score (40-second recruiter skim)

**7.5 / 10.** The README leads with a live demo link, a Swagger link, a one-line demo login, badges (including a real CI status badge, not a static SVG lie), and five real product screenshots before any setup instructions. A recruiter skimming for 40 seconds sees: it deploys, it has tests (badge), it has a coherent "why," and it isn't a tutorial clone. What costs it a full grade: no LICENSE file, no visible "About Me" tie-in (no portfolio/LinkedIn context in the repo itself), and the domain (perfume batch math) is niche enough that a non-technical skimmer might undervalue the engineering under it.

## Strengths (with evidence)

- **Domain modeling is unusually deep for this level.** The README's "Design decisions" section (`README.md:48-64`) justifies six non-obvious choices — weight-native math, split concentration/proportion percentages, `PROTECT` over `CASCADE`, snapshot-not-versioning, subtraction-derived diluent, advisory-not-automatic maceration status — each with the rejected alternative and *why* it was rejected. This is the kind of writeup you normally get from someone who's been burned by the naive version once already.
- **Money-math correctness habits, done right.** `formulations/models.py:141-195`: `Batch.compute()` uses `Decimal` with explicit `ROUND_HALF_UP` quantization, wraps the write in `transaction.atomic()`, and has the last ingredient row "absorb" the rounding remainder so the per-ingredient breakdown sums exactly to `aromatic_g` — a real fix for a real float/Decimal-drift bug class, not cargo-culted.
- **Ownership isolation is done at the query level, not just permissions.** Every viewset filters `get_queryset()` by `owner=self.request.user` before the object is ever fetched (`formulations/views.py:34-112`), and the README explicitly explains why this returns 404 instead of 403 for another user's object (`README.md:64`) — a subtle security-through-obscurity tradeoff most juniors don't articulate, they just happen to get it right or wrong.
- **JWT refresh handled correctly on the frontend.** `frontend/src/api/client.ts` dedupes concurrent 401s into a single in-flight `/token/refresh/` call via a shared promise, rather than firing N parallel refreshes — a race condition that trips up a lot of mid-level devs.
- **Verified I could actually log in and hit the live API.** `POST /api/token/` with `demo`/`demopass123` returns a valid JWT pair; `GET /api/batches/` returns real seeded data whose math checks out (`aromatic_g` 7.20 + `diluent_g` 32.80 = `batch_size_g` 40.00 exactly); unauthenticated requests correctly 401; a nonexistent batch ID correctly 404s rather than leaking existence via 403.
- **CI is real and green, not decorative.** `.github/workflows/tests.yml` runs three separate jobs — `ruff check`/`ruff format --check`, Django tests against an actual Postgres service container, and a frontend job (`tsc -b`, `npm run build`, `npm run test`). Last 10 Actions runs are all `success`.
- **Sourcery bot findings get actually fixed, in dedicated commits.** PRs #5 and #6 are both literally titled "fix: apply verified Sourcery findings" and address real bugs Sourcery flagged (non-atomic batch compute, maceration progress going negative on future dates, a React state-during-render bug). This is a good, honest signal: the author uses automated review and closes the loop instead of merging past it.
- **Housekeeping discipline.** Commit `668c72f "chore: remove unused Postman workspace scaffold"` — someone actively pruned dead artifacts rather than letting them rot in the tree.
- **36 backend test methods** (`formulations/tests.py`, 543 lines) covering auth, cross-user ownership isolation (including FK-injection via `recipe-ingredients`), Decimal-precision gram math at both extremes (4g tester, 20,000g batch), unbalanced-recipe saves, and that derived fields can't be client-forged.

## Weaknesses & Red Flags

- **`main` is not branch-protected.** `gh api .../branches/main/protection` returns 404 ("Branch not protected"). Every PR *is* still routed through a pull request in practice (11/11 merged PRs, no direct pushes since commit `f3171e3`), but nothing technically enforces that — a recruiter/senior checking settings will see no gate, no required review, no required CI-pass-before-merge.
- **No LICENSE file.** For a public portfolio repo this is a small but real gap — it signals "I didn't think about how others would consume this," and it's a two-minute fix that's still undone.
- **Insecure fallback secret in settings.** `core/settings.py:29`: `SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-secret-key')`. If the env var is ever unset in a deploy, Django silently starts with a known, hardcoded secret instead of failing loudly. Low real-world risk here (Railway has it set), but it's the kind of "quick-start default left in" that a security-conscious senior would flag in review.
- **Solo-authored, no external review.** Every PR is opened and merged by the same account; Sourcery (a bot) is the only reviewer that ever left comments. That's expected for a solo portfolio project, but it means the "PR workflow" is process theater in the sense that nothing was ever actually blocked by a second human — worth knowing going in, not a knock on the work itself.
- **PR descriptions are bot-generated, not author-written.** Every PR body is literally headed "## Summary by Sourcery" — useful, but it means the interview should probe whether the candidate can *write* a clear technical summary themselves, since the repo doesn't demonstrate that skill directly.
- **E2E (Playwright) tests exist but don't run in CI.** `frontend/e2e/happy-path.spec.ts` covers the real ingredient → recipe → batch → note flow, but `tests.yml`'s `frontend` job only runs `npm run test` (Vitest unit tests) — Playwright is documented as local-only in `frontend/e2e/README.md`. Reasonable call (e2e needs a live backend), but it's a real coverage gap between what's written and what's enforced.
- **`Ingredient.dilution_strength` and `density_g_per_ml` are dead-ish fields.** Both are explicitly commented as "not used in v1 math" / "display-only, never used in core math" (`models.py:25-30`). Honest to document, but it's schema for a feature that doesn't exist yet — a senior would ask whether this should have waited for the feature that needs it.
- **Single-developer commit history with no collaborators, no issues, no discussions.** Zero open issues, zero non-author PRs. Fine for a solo project, but it means the repo can't demonstrate collaboration, code review *received*, or conflict resolution — all things an interview will need to probe separately.

## What's Missing That a Senior Would Expect

- Branch protection / required status checks before merge (present in intent, absent in config).
- A LICENSE.
- Rate-limit/throttle coverage beyond `register` and `ai_summarize` — the core CRUD endpoints (`batches`, `recipes`, etc.) have no throttle scope, which is fine for a demo but would come up in a "how would you productionize this" conversation.
- Any error monitoring/observability beyond console logging (no Sentry, no structured logging shipped anywhere — `LOGGING` in `settings.py` is console-only).
- API versioning story (`/api/v1/...` vs bare `/api/...`) — a minor omission, but the kind of thing that bites once the API has external consumers.
- A CHANGELOG or release tags — 24 commits, zero tags, no version markers, so "what shipped when" is only reconstructible from PR merge dates.

## Live-Demo Assessment

Verified functionally via direct API calls (login, list ingredients/recipes/batches, auth failure, 404 isolation) since this is a scripted review pass rather than a manual browser session — all of it worked as documented, no daylight between the README's claims and actual behavior:

- Login with `demo`/`demopass123` against the live Railway backend succeeds and returns a valid JWT pair on the first try — the demo isn't broken or stale.
- Seeded data is real and coherent: 12 ingredients (Bergamot, Lemon, Hedione, Cedarwood, Vetiver, Iso E Super, Ambroxan, etc. with supplier + tasting notes), 3 recipes at different concentrations (e.g., "Citrus Bloom Cologne" at 8% with a 40/30/... proportion split), and live batches whose frozen gram math is internally consistent to the cent.
- Reading the actual frontend source (not just the rendered page) for `BatchNew.tsx`, `Dashboard.tsx`, and `client.ts` shows real production polish, not just happy-path code: explicit `isLoading`/`isError` states, disabled-submit-while-pending buttons, per-field validation errors surfaced from DRF's error shape, an in-UI warning when a recipe's proportions don't sum to 100%, and a live client-side preview calculator that mirrors the server's gram math before submit.
- Swagger UI (`/api/docs/`) is backed by a real, clean OpenAPI 3 schema (`drf-spectacular`) — consistent REST resource naming (`ingredients`, `recipes`, `recipe-ingredients`, `batches`, `batch-notes`), all list endpoints paginated the same way, JWT bearer auth documented on protected routes.
- Caveat: this review did not visually render the SPA in a browser (no browser-automation tool available in this pass), so specific claims about pixel-level polish, animation, or responsive layout are inferred from source code and screenshots in the README rather than directly observed on-screen. Everything *functional* was verified live against the real deployed backend.

## Top 5 Improvements, Ranked by Impact-per-Effort

1. **Turn on branch protection on `main`** (require PR + passing CI before merge). Five minutes in GitHub settings; closes the single biggest gap between "looks disciplined" and "is enforced."
2. **Add a LICENSE file.** One minute; removes a checkbox a recruiter or another engineer will notice is missing.
3. **Fail loudly instead of falling back on `SECRET_KEY`.** Change `os.getenv('SECRET_KEY', 'fallback-secret-key')` to raise if unset in non-DEBUG mode. Ten minutes; removes a real (if currently dormant) security smell.
4. **Wire the existing Playwright e2e suite into CI** (spin up the Django server + Postgres in the same job, or against a preview deploy). The test already exists and is well-scoped (`happy-path.spec.ts`) — this is "connect what's already written," not new work, and it closes the biggest real coverage gap.
5. **Write one non-bot-generated PR description** (or a short DEVLOG/retro entry) in the author's own words about a real tradeoff hit while building this. The README's "Design decisions" section proves the reasoning ability exists — right now that ability is demonstrated to a reader of the README, but every PR itself is Sourcery's voice, not the author's.

## How It Compares to a Typical Junior-Dev Portfolio Project

Above median, clearly. The typical junior portfolio repo is a CRUD app with a tutorial-shaped README, no tests or a handful of trivial ones, no CI, and model design that's a straight 1:1 mapping of UI screens to database tables. This repo has: a domain model that required actual thought (weight vs. volume, snapshot vs. versioning), Decimal-precision money-shaped math handled correctly, 36 real backend tests plus frontend unit + e2e tests, three-job CI that's actually green, ownership-isolation reasoning documented and tested (including an FK-injection cross-user attack test), and a live, working, non-trivial demo with real seeded data. What keeps it from reading as mid-level-or-above at a glance is process maturity, not code quality: no branch protection, no LICENSE, PR descriptions outsourced to a bot, and zero evidence of working with another human on this code. Those are all fixable in an afternoon and don't change the assessment of the underlying engineering ability.

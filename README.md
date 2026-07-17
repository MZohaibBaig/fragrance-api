# Fragrance Lab API

**Live demo:** https://fragrance-api-eight.vercel.app    
**API docs (Swagger):** https://web-production-265e0.up.railway.app/api/docs/

> Create an account on the login screen to try it, or use the demo login below.  
> Demo user: `demo` / `demopass123`

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)  
![Django](https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white)  
![DRF](https://img.shields.io/badge/DRF-3.17-A30000?logo=django&logoColor=white)  
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)  
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)  
![Tests](https://github.com/MZohaibBaig/fragrance-api/actions/workflows/tests.yml/badge.svg)

A REST API for DIY perfumery: recipes and the physical batches mixed from them, tracked by weight.

Built for the way an oil-and-ethanol perfumer actually works: a **Recipe** (which aromatic materials, at what proportions, at what target concentration) is mixed into a **Batch** (a specific weighed mix, from a 4 g tester to a 20,000 g production run), which macerates and gets evaluated with dated **notes**. Every batch's gram math is computed and frozen server-side at mix time, so editing a recipe later never rewrites history. Each user's data is isolated from every other user's.

## Domain model

This system is **weight-native**: everything is grams, weighed on a 0.01 g scale. There is no volume unit anywhere in the core math.

A finished perfume is an aromatic phase (one or more fragrance materials) dissolved in a diluent (ethanol, DPG, IPM, ...). The diluent is never its own ingredient row — it's always the remainder: `batch weight - aromatic weight`.

Two levels of percentage, not to be confused:

- **`Recipe.default_concentration`** — percent of the *finished perfume*, by weight, that is aromatic material (e.g. `22`).  
- **`RecipeIngredient.proportion`** — each material's share *within the aromatic phase*, meant to sum to 100 across a recipe. A single-oil recipe is one row at 100.

All percentages are weight-by-weight (w/w). A recipe doesn't have to sum to 100 to be saved — `Recipe.is_balanced` and `proportions_total` tell you when it's incomplete, they never block a save.

**Worked example** — 40 g batch, 22% concentration, two oils at 60/40:  
aromatic phase 8.8 g (oil A 5.28 g, oil B 3.52 g) → diluent 31.2 g. Total 40 g, exactly.

Batch quantities are stored at full precision internally and rounded to 0.01 g (the scale's resolution) for display.

### Models

- **`Ingredient`** — a raw material: name, supplier, article number, `dilution_strength` (reserved for future diluted-material math, unused in v1), `density_g_per_ml` (display-only), notes.  
- **`Recipe`** — a formula: name, `default_concentration`, `diluent_name`, `default_maceration_days`. Unique per owner by name.  
- **`RecipeIngredient`** — an ingredient's share of a recipe's aromatic phase.  
- **`Batch`** — one physical mix of a recipe: `batch_size_g` (unbounded), `concentration` and `maceration_days` (snapshotted from the recipe at creation, overridable), `made_on`, `status` (macerating / ready / archived), `rating`. Frozen at compute time: `aromatic_g`, `diluent_g`, `recipe_was_balanced`, and a per-ingredient `BatchIngredient` breakdown — all read-only from the API, never client-settable. Batches reference their recipe with `PROTECT`, so a recipe can't be deleted out from under lab history.  
- **`BatchNote`** — a dated smell-test note on a batch, with a derived `day_number` (days since `made_on`).

Maceration is tracked, never automated: `is_due`, `days_macerating`, `ready_on`, `days_remaining`, and `maceration_progress` are all calendar-derived hints. `status` only ever changes via an explicit request — the calendar suggests, your nose decides.

## Design decisions

**Weight-native (w/w), not volume.** Every quantity in the core math is grams. The alternative — tracking volume in ml, as a syringe-and-bottle workflow might suggest — would require a density figure for every material to convert to/from weight, and perfumery ingredients vary widely in density. Working in weight throughout removes density from the math entirely; `Ingredient.density_g_per_ml` exists only as an optional display hint, never as an input to any calculation.

**Two levels of percentage.** `Recipe.default_concentration` is the aromatic phase's share of the *finished perfume*; `RecipeIngredient.proportion` is a material's share *within the aromatic phase*, summing to 100 across the recipe. The diluent is never its own ingredient row. The alternative — one flat list where the diluent is just another row and everything sums to 100 — sounds simpler but breaks the moment you want to override concentration per batch: change concentration and every single row's percentage, diluent included, has to be recalculated and rewritten. Splitting concentration out means overriding it on a batch is a one-field change; the aromatic phase's internal proportions don't move.

**Snapshots, not recipe versioning.** `BatchIngredient` denormalizes the full breakdown (ingredient name, proportion, grams) onto the batch at mix time. Editing a recipe afterward — changing proportions, adding a material — never touches existing batches. The alternative, immutable `RecipeVersion` snapshots with batches pointing at a specific version, would buy the ability to ask "what did version 3 of this recipe look like" as a first-class query. That's not a question this app needs answered; the batch itself already is the historical record of what was weighed. Versioning would add a second layer of history-keeping on top of one that already exists for the reason that actually matters.

**Diluent computed by subtraction.** `diluent_g = batch_size_g - aromatic_g`, always, rather than computing diluent independently from its own percentage. This means the two quantities sum to the batch size exactly, by construction, regardless of rounding — there's no scenario where independently-rounded parts drift a hundredth of a gram off the whole.

**`PROTECT` on `Recipe` and `Ingredient` foreign keys.** `Batch.recipe`, `RecipeIngredient.ingredient`, and `BatchIngredient.ingredient` all use `on_delete=PROTECT`. Deleting a recipe or material that's in use raises an error instead of cascading. The alternative, `CASCADE` (what the original `FormulaIngredient` design used), would silently delete batches — lab history — the moment someone deletes a recipe, or silently corrupt a recipe's proportions the moment someone deletes a material it references. Forcing an explicit error is the only option that doesn't lose data quietly.

**`is_due` is advisory; status never auto-flips.** `is_due`, `days_macerating`, `ready_on`, `days_remaining`, and `maceration_progress` are all computed fresh on every read from `made_on`/`maceration_days`/`status` — none are stored, and none of them ever change `status` themselves. The alternative, a scheduled job that flips `macerating` to `ready` once the calendar says so, assumes the calendar is the authority on whether a perfume is actually ready. It isn't — maceration time is a guideline, not a guarantee, and the only reliable test is smelling it. The calendar surfaces a suggestion; a human still has to act on it.

**Unbalanced recipes are allowed but flagged.** A `Recipe` can be saved, and a `Batch` can be mixed from it, even if its `RecipeIngredient` proportions don't sum to 100 — blocking the save would make it impossible to build a recipe up one material at a time. Instead, `Recipe.is_balanced`/`proportions_total` and `Batch.recipe_was_balanced` report the truth without enforcing it, so a work-in-progress recipe is always saveable and a batch always carries an honest record of whether the numbers behind it were complete.

**Owner scoping lives in `get_queryset`, not only in a permission class.** Every viewset filters its queryset by the requesting user before any object is fetched, rather than fetching by id and relying solely on an object-level permission check. The practical difference: a request for another user's object 404s (it was never in the queryset) instead of 403ing (it existed and permission was denied) — the latter confirms the id exists, the former doesn't. The same principle extends to writes: every serializer that accepts a foreign key to an owned object (`recipe`, `ingredient`, `batch`) restricts that field's queryset to the requesting user's own objects, so a client can't attach a new object to someone else's recipe or batch just by guessing its id — that request fails validation before it ever reaches the database.

## Tech Stack

- Python, Django, Django REST Framework, django-filter, django-cors-headers, drf-spectacular  
- PostgreSQL  
- JWT via djangorestframework-simplejwt  
- AI note summarization via Groq's API (server-side call, API key from env, rate-limited to 20/hour per user, mocked in tests)  
- Logging via Django's standard `LOGGING` config (console handler; `formulations` logger emits INFO on every batch gram-math computation and user registration, WARNING on unbalanced-recipe batches and rejected weak passwords)  
- Linting/formatting via `ruff`, enforced locally through a `pre-commit` hook

## Screenshots

**Dashboard — batch activity at a glance**  
<img width="700" alt="Dashboard" src="https://github.com/user-attachments/assets/b8fca639-826e-490d-812c-5cadece945f3" />

**New batch with live calculator** — per-ingredient breakdown; server-computed values frozen on save  
<img width="700" alt="New batch with live calculator" src="https://github.com/user-attachments/assets/a813a4ba-855e-4fc3-b8f2-f321f103f5cb" />

**Batches — maceration progress tracking**  
<img width="700" alt="Batches list" src="https://github.com/user-attachments/assets/e0ceefc6-57d1-40d7-b60d-b04fcdd53014" />

**Recipes**  
<img width="700" alt="Recipes" src="https://github.com/user-attachments/assets/f7b99de9-1f16-4e28-8340-40c91d26de8c" />

**Ingredients — materials, suppliers, and tasting notes**  
<img width="700" alt="Ingredients" src="https://github.com/user-attachments/assets/beb22715-5c7d-440b-a8be-16fffee3d37e" />  

## Setup

Clone and enter the project:

```bash  
git clone https://github.com/MZohaibBaig/fragrance-api.git  
cd fragrance-api  
python -m venv venv  
```

Activate the virtual environment:

```bash  
# Windows (PowerShell / cmd)  
venv\Scripts\activate

# macOS / Linux  
source venv/bin/activate  
```

Install dependencies, configure environment, and run:

```bash  
pip install -r requirements.txt  
cp .env.example .env    # Windows: copy .env.example .env  
# then open .env and fill in your real SECRET_KEY and DB credentials.  
# For local development also set DEBUG=True (or ALLOWED_HOSTS) and  
# CORS_ALLOWED_ORIGINS to your frontend's origin — see .env.example.  
python manage.py migrate  
python manage.py runserver  
```

For linting/formatting/pre-commit, install the dev extras instead and wire up the hook once:

```bash  
pip install -r requirements-dev.txt  
pre-commit install  
```

`pre-commit` then runs `ruff check --fix` and `ruff format` on every commit. Run it against the whole tree any time with `pre-commit run --all-files`.

## Demo data

Populate a user's account with realistic sample ingredients and recipes (idempotent — safe to re-run):

```bash  
python manage.py seed_demo --user <username>  
```

Seeds ~12 perfumery materials (Bergamot, Hedione, Ambroxan, Vetiver, ...) and 3 invented recipes at different concentrations, each with proportions summing to 100.

## API Docs

Interactive Swagger UI is served at `/api/docs/` (raw OpenAPI schema at `/api/schema/`) once the server is running — a quicker way to explore/try requests than this table.

## API Endpoints

| Method | Endpoint                     | Description                                  |  
| ------ | ----------------------------- | --------------------------------------------- |  
| POST   | /api/register/                 | Create an account (rate-limited to 5/hour per IP) |  
| POST   | /api/token/                    | Get access and refresh tokens                 |  
| POST   | /api/token/refresh/            | Refresh access token                          |  
| GET    | /api/ingredients/               | List ingredients                              |  
| POST   | /api/ingredients/               | Create ingredient                             |  
| GET/PUT/PATCH/DELETE | /api/ingredients/{id}/  | Retrieve / update / delete ingredient          |  
| GET    | /api/recipes/                   | List recipes                                  |  
| POST   | /api/recipes/                   | Create recipe                                 |  
| GET/PUT/PATCH/DELETE | /api/recipes/{id}/      | Retrieve / update / delete recipe              |  
| GET    | /api/recipe-ingredients/?recipe={id} | List a recipe's ingredient rows          |  
| POST   | /api/recipe-ingredients/        | Attach an ingredient to a recipe at a proportion |  
| GET/PUT/PATCH/DELETE | /api/recipe-ingredients/{id}/ | Retrieve / update / remove a recipe ingredient |  
| GET    | /api/batches/?recipe={id}&status={status}&is_due={true\|false} | List/filter batches |  
| POST   | /api/batches/                   | Mix a new batch                               |  
| GET/PUT/PATCH/DELETE | /api/batches/{id}/       | Retrieve / update / delete batch               |  
| GET    | /api/batch-notes/?batch={id}    | List a batch's smell-test notes               |  
| POST   | /api/batch-notes/                | Add a dated note                              |  
| GET/PUT/PATCH/DELETE | /api/batch-notes/{id}/   | Retrieve / update / remove a note              |

List endpoints are paginated (20 per page, DRF's standard `?page=` param) and return `{"count", "next", "previous", "results"}`.

## Authentication

Register, then log in and include the access token on every request:

```  
POST /api/register/  
{ "username": "you", "email": "you@example.com", "password": "..." }

POST /api/token/  
{ "username": "you", "password": "..." }  
-> { "access": "...", "refresh": "..." }  
```

```  
Authorization: Bearer <access>  
```

`POST /api/token/refresh/` with `{ "refresh": "..." }` before the access token expires.

## Example — batch detail

`GET /api/batches/{id}/` for a 40 g batch of a two-oil, 22%-concentration recipe, made 10 days ago:

```json  
{  
  "id": 1,  
  "recipe": 1,  
  "batch_size_g": "40.00",  
  "concentration": "22.00",  
  "maceration_days": 28,  
  "made_on": "2026-07-04",  
  "status": "macerating",  
  "rating": null,  
  "created_at": "2026-07-14T08:48:34.379488Z",  
  "aromatic_g": "8.80",  
  "diluent_g": "31.20",  
  "recipe_was_balanced": true,  
  "days_macerating": 10,  
  "ready_on": "2026-08-01",  
  "days_remaining": 18,  
  "maceration_progress": "35.71",  
  "is_due": false,  
  "ingredients": [  
    { "id": 1, "ingredient": 2, "ingredient_name": "Bergamot", "proportion": "60.00", "grams": "5.28" },  
    { "id": 2, "ingredient": 3, "ingredient_name": "Sandalwood", "proportion": "40.00", "grams": "3.52" }  
  ],  
  "notes": [  
    { "id": 1, "batch": 1, "observed_on": "2026-07-07", "body": "Bright citrus top, ethanol still sharp.", "day_number": 3, "created_at": "2026-07-14T08:48:34.391120Z" }  
  ]  
}  
```

`aromatic_g`, `diluent_g`, `recipe_was_balanced`, and `ingredients[].grams` are computed and frozen server-side at batch-creation time — a client cannot set them. `days_macerating`, `ready_on`, `days_remaining`, `maceration_progress`, and `is_due` are recomputed on every read from `made_on`/`maceration_days`/`status`; none of them are stored.

## Running Tests

```bash  
python manage.py test  
```

Tests run against a real PostgreSQL test database (created and torn down automatically) and cover: authentication, cross-user ownership isolation on ingredients/recipes/batches (including cross-user FK injection via `recipe-ingredients`), the gram math (single- and multi-ingredient batches, a 4 g tester, a 20,000 g production run, and exact-sum/no-Decimal-drift checks), that a half-built recipe can be saved without blocking, that derived batch fields can't be forged by a client, maceration/`is_due` logic (including that overdue status never auto-flips), and registration. CI runs the same suite on every push and pull request against a Postgres service container (see `.github/workflows/tests.yml`).

## License

MIT — see [LICENSE](LICENSE).

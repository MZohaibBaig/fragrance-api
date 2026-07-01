# Fragrance Formulation API

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/DRF-3.17-A30000?logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)
![Tests](https://github.com/MZohaibBaig/fragrance-api/actions/workflows/tests.yml/badge.svg)

A REST API for managing fragrance formulations built with Django, Django REST Framework, and PostgreSQL.

<!-- REVIEW: confirm/replace -->
Built to model how a fragrance formulator actually tracks work: raw ingredients with supplier/COA data, formulas built from those ingredients at precise percentages, and the batch quantities that follow from them. Each user's ingredients and formulas are isolated from every other user's.

## Features

- JWT Authentication — secure token-based auth
- Ingredient management — track aroma chemicals with supplier and COA info
- Formula management — build formulations with precise percentages
- Automatic batch calculation — quantities computed from percentage and batch size
- User isolation — users can only access their own data

## Tech Stack

- Python, Django, Django REST Framework
- PostgreSQL
- JWT via djangorestframework-simplejwt

## Setup

```bash
git clone https://github.com/MZohaibBaig/fragrance-api.git
cd fragrance-api
python -m venv venv
venv\Scripts\activate  # on Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env  # then fill in your real SECRET_KEY and DB credentials
python manage.py migrate
python manage.py runserver
```

## API Endpoints

| Method | Endpoint               | Description                   |
| ------ | ---------------------- | ----------------------------- |
| POST   | /api/token/            | Get access and refresh tokens |
| POST   | /api/token/refresh/    | Refresh access token          |
| GET    | /api/ingredients/      | List all ingredients          |
| POST   | /api/ingredients/      | Create ingredient             |
| GET    | /api/ingredients/{id}/ | Get single ingredient         |
| PUT    | /api/ingredients/{id}/ | Update ingredient             |
| DELETE | /api/ingredients/{id}/ | Delete ingredient             |
| GET    | /api/formulas/         | List all formulas             |
| POST   | /api/formulas/         | Create formula                |
| GET    | /api/formulas/{id}/    | Get single formula            |
| PUT    | /api/formulas/{id}/    | Update formula                |
| DELETE | /api/formulas/{id}/    | Delete formula                |

## Authentication

All endpoints require JWT authentication. Include the access token in every request header:

```
Authorization: Bearer your_access_token
```

## Examples

<!-- Captured from a live run via DRF's APIClient against the actual serializers/views, not hand-written. -->

**`POST /api/ingredients/`**

Request:

```json
{
  "name": "Bergamot",
  "article_number": "BRG-001",
  "supplier": "Firmenich",
  "description": "Top note citrus oil"
}
```

Response `201 Created`:

```json
{
  "id": 1,
  "name": "Bergamot",
  "article_number": "BRG-001",
  "supplier": "Firmenich",
  "description": "Top note citrus oil",
  "created_at": "2026-07-01T11:05:31.852418Z"
}
```

**`POST /api/formulas/`**

Request:

```json
{
  "name": "Citrus Bloom",
  "description": "Fresh summer scent",
  "target_fragrance": "Citrus Floral",
  "batch_size_ml": "200.00"
}
```

Response `201 Created`:

```json
{
  "id": 1,
  "name": "Citrus Bloom",
  "description": "Fresh summer scent",
  "target_fragrance": "Citrus Floral",
  "batch_size_ml": "200.00",
  "created_at": "2026-07-01T11:05:31.863617Z",
  "formula_ingredients": []
}
```

**`GET /api/formulas/{id}/`** (after adding a `FormulaIngredient` linking the formula above to the ingredient above at 12.50%)

Response `200 OK`:

```json
{
  "id": 1,
  "name": "Citrus Bloom",
  "description": "Fresh summer scent",
  "target_fragrance": "Citrus Floral",
  "batch_size_ml": "200.00",
  "created_at": "2026-07-01T11:05:31.863617Z",
  "formula_ingredients": [
    {
      "id": 1,
      "ingredient": 1,
      "ingredient_name": "Bergamot",
      "percentage": "12.50",
      "quantity_in_grams": "25.00"
    }
  ]
}
```

## Running Tests

```bash
python manage.py test
```

Tests run against a real PostgreSQL test database (created and torn down automatically) and cover authentication, ownership isolation, and the `quantity_in_grams` calculation. CI runs the same suite on every push and pull request against a Postgres service container (see `.github/workflows/tests.yml`).

# Fragrance Formulation API

A REST API for managing fragrance formulations built with Django, Django REST Framework, and PostgreSQL.

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

1. Clone the repo
2. Create and activate virtual environment
3. Install dependencies: `pip install -r requirements.txt`
4. Create `.env` file with your database credentials
5. Run migrations: `python manage.py migrate`
6. Start server: `python manage.py runserver`

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

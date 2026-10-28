web: python manage.py migrate --noinput && gunicorn core.wsgi --bind 0.0.0.0:${PORT:-8000}

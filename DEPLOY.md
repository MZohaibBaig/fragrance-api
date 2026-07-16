# Deploy Checklist

## Railway (backend)
- [ ] `SECRET_KEY` — random secret
- [ ] `DEBUG` — `False`
- [ ] `ALLOWED_HOSTS` — e.g. `your-api.up.railway.app`
- [ ] `DATABASE_URL` — provided by Railway Postgres plugin
- [ ] `CORS_ALLOWED_ORIGINS` — e.g. `https://your-frontend.vercel.app`
- [ ] `CSRF_TRUSTED_ORIGINS` — e.g. `https://your-frontend.vercel.app`
- [ ] `GROQ_API_KEY` — Groq API key for AI note summarization

## Vercel (frontend)
- [ ] `VITE_API_URL` — e.g. `https://your-api.up.railway.app/api`

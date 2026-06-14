# BasketIQ

Cross-platform grocery / quick-commerce price comparison (Blinkit · Zepto · Swiggy Instamart) with an AI shopping assistant.

> **Source of truth for architecture, status, env vars and the current phase entry point lives in [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).** Read that first.

## Monorepo layout

```
basketiq/
├── PROJECT_CONTEXT.md    # living source of truth
├── mobile/               # Expo + React Native + TypeScript app
├── backend/              # FastAPI (Python 3.11+) API + AI services
└── supabase/             # SQL migrations
```

## Quick start

See **Run instructions** in `PROJECT_CONTEXT.md`. Short version:

```bash
# backend
cd backend && python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# mobile (separate terminal)
cd mobile && npm install && npx expo install --fix
cp .env.example .env   # set EXPO_PUBLIC_API_URL
npx expo start
```

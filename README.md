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

## Live price engine (Phase 9) — optional, off by default

By default the app reads the **seeded** catalog through `platform_prices` (the
proven demo path). Turn on live, on-demand fetching:

```bash
# backend/.env
LIVE_PRICES_ENABLED=true
DEFAULT_PINCODE=500081        # Hyderabad (Gachibowli) test value
DEFAULT_LAT=17.4435
DEFAULT_LON=78.3772
PRICE_TTL_MINUTES=20          # cache TTL before a query is re-fetched
COLLECTOR_TIMEOUT_S=8

# browser fallback (only path that bypasses anti-bot) — install separately:
cd backend
pip install -r collectors/requirements-collectors.txt
playwright install chromium
```

With it on, `/search?q=...&pincode=...` checks freshness; stale/missing queries
trigger the 3 collectors concurrently (8s timeout each, circuit breaker + rate
limit), map offers to master products, and upsert fresh `platform_prices`. Any
blocked/slow platform degrades to seed/cache and is flagged in `sources[].status`.

**Run live from a residential connection** (a home laptop), not a datacenter IP.

### Collector reliability (probed 2026-06)
| Platform | Direct API (httpx) | Notes |
|---|---|---|
| **Zepto** | ✅ web 200, ⚠️ search API gated | Most accessible; needs store_id (location) + tokens → browser fallback is the reliable path. |
| **Blinkit** | ❌ 403 on every path | Hard WAF/bot-management; browser fallback needs a hardened, likely non-headless session. |
| **Instamart** | ❌ 403 / 202 empty | Most locked-down; cookies + location + anti-bot required. |

All three currently rely on the **Playwright browser fallback** for real data;
the httpx internal-API path is blocked from server-side clients. When a collector
can't fetch, BasketIQ serves seeded prices so a search never returns nothing.

### ⚖️ ToS / usage disclaimer
This live-fetching is for **low-volume personal / portfolio use only**. It fetches
**on demand, per searched item** (never bulk crawls), caches aggressively (TTL),
rate-limits, and backs off on failure. Respect each platform's Terms of Service
and `robots.txt`; do not run at scale or commercially. Seeded data is the default.

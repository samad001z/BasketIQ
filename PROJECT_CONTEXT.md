# PROJECT_CONTEXT.md — BasketIQ

> Living source of truth. Updated at the end of every phase. Read this first.

BasketIQ is a cross-platform mobile app (Android-first, iOS later) that compares
grocery / quick-commerce prices across **Blinkit, Zepto and Swiggy Instamart**
and uses AI to find the cheapest basket, best value, and smartest cross-platform
split.

---

## Non-negotiable constraints

- **Low budget.** Supabase free tier, Expo free tier. **AI runs on Vertex AI
  using the user's Vertex credits** (see decision below). Keep local processes
  light (RTX 3050 laptop, 16 GB RAM).
- **Data source is decoupled.** The app and AI NEVER assume where price data
  comes from — everything reads from the `platform_prices` table. Mock seed data
  now; real scrapers are an optional `collectors/` module much later (Phase 8).
  No Playwright in early phases.
- **AI = Gemini via Vertex AI** (`google-genai` SDK, `vertexai=True`, service
  account auth). _Changed from the original AI-Studio plan at the user's request
  in Phase 1 — they have Vertex credits._
  - Chat / vision / reasoning: `gemini-2.5-flash`
  - Embeddings: `gemini-embedding-001`, `output_dimensionality=768`, correct
    `task_type` (`RETRIEVAL_DOCUMENT` for products, `RETRIEVAL_QUERY` for searches).
- **Latest stable Expo SDK (56).** TypeScript everywhere.
- **Secrets only in gitignored files.** `.env` + `sa-vertex.json` are gitignored;
  `.env.example` holds placeholders only.

---

## Architecture (current)

```
basketiq/
├── PROJECT_CONTEXT.md        # this file
├── README.md
├── .gitignore                # ignores .env, sa-vertex.json, node_modules, venv
├── mobile/                   # Expo + RN + TS app
│   ├── app/
│   │   ├── _layout.tsx       # providers + font loading (Inter + Space Grotesk)
│   │   ├── index.tsx         # Search/home: searchbar + chips + ResultCard + CartButton
│   │   ├── product/[id].tsx  # Detail: 3-platform compare + sticky add-to-cart
│   │   └── cart.tsx          # Cart list + Optimize → OptimizedSplit ← Phase 5
│   ├── components/           # ResultCard, PlatformCompareCard, SearchBar, CategoryChips,
│   │   │                     #   PressableScale, PlatformDot, StateViews,
│   │   │                     #   CartControl, CartButton, OptimizedSplit ← Phase 5
│   ├── lib/
│   │   ├── api.ts            # typed client: getHealth/getProducts/search/optimize
│   │   ├── theme.ts          # tokens: accent, platform meta, emoji, motion, shadow
│   │   ├── pricing.ts        # computeBestOption + formatINR (mirrors backend)
│   │   ├── queryClient.ts
│   │   └── hooks/            # useProducts/useProduct, useSearch, useDebouncedValue, useOptimize
│   ├── store/useCartStore.ts # Zustand cart (client-only) ← Phase 5
│   └── configs: app.json, babel/metro, tailwind.config.js (theme), global.css, package.json
├── backend/                  # FastAPI (Python 3.11+)
│   ├── main.py               # app, CORS, routers
│   ├── .env / .env.example / sa-vertex.json
│   ├── app/
│   │   ├── config.py         # pydantic-settings (.env): Supabase + Vertex
│   │   ├── routes/
│   │   │   ├── health.py     # GET /health  (Supabase + Vertex status)
│   │   │   ├── products.py   # GET /products (paginated, prices embedded) ← Phase 2
│   │   │   ├── search.py     # GET /search  (semantic + best_option) ← Phase 3
│   │   │   ├── cart.py       # POST /optimize (cheapest split) ← Phase 5
│   │   │   └── user/assistant/vision.py  # stubs
│   │   ├── services/
│   │   │   ├── matcher.py    # cosine search + Gemini tie-break ← Phase 3
│   │   │   ├── optimizer.py  # 7-subset cheapest split ← Phase 5
│   │   │   └── recommender.py  # stub
│   │   ├── tests/test_optimizer.py  # pure optimizer unit tests ← Phase 5
│   │   ├── ai/gemini.py      # Vertex client + embed_texts/same_product ← Phase 3
│   │   ├── database/supabase.py   # client (service role) + check_supabase()
│   │   └── utils/schemas.py  # Pydantic: Health*/Product*/Search* models
│   ├── seed/
│   │   ├── seed_catalog.py   # idempotent seeder ← Phase 2
│   │   ├── embed_products.py # embedding backfill (768d) ← Phase 3
│   │   └── data/catalog.json # 80 items × 3 platforms ← Phase 2
│   ├── collectors/README.md  # OPTIONAL scrapers — Phase 8 ONLY
│   └── requirements.txt
└── supabase/migrations/
    ├── 0001_init_pgvector_products_prices.sql   # APPLIED
    ├── 0002_full_schema_and_rls.sql             # APPLIED
    └── 0003_embedding_index_and_match_rpc.sql   # ⚠ run in dashboard (DDL)
```

### Conventions
- Every endpoint has typed Pydantic request + response models. No raw dicts.
- Supabase access only via `app/database/supabase.py`. Server uses the
  service-role key (bypasses RLS).
- Mobile → backend only via `mobile/lib/api.ts` + React Query hooks.
- Migrations are versioned SQL. **DDL is applied via the Supabase SQL Editor**
  (the connected MCP account doesn't include this project, and the REST key
  can't run DDL); data writes/reads go through the service-role key over REST.

### Tech stack (locked)
- **Mobile:** Expo Router, NativeWind, TanStack Query, Zustand, Reanimated v4.
- **Backend:** FastAPI, `google-genai` (Vertex), `supabase>=2.31`, Pydantic v2, uvicorn.
- **Infra:** Supabase — Postgres + pgvector, Auth (email + Google only, NO
  phone/OTP), Storage, Realtime (later).

---

## Environment variables

**`backend/.env`** (real values, gitignored):
| var | meaning |
|---|---|
| `SUPABASE_URL` | project URL (`pxckstdsaaxppynooqza`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` server key (bypasses RLS; never ship to app) |
| `GOOGLE_APPLICATION_CREDENTIALS` | path to `sa-vertex.json` (`./sa-vertex.json`) |
| `GOOGLE_CLOUD_PROJECT` | GCP project for Vertex (`gen-lang-client-0293946864`) |
| `GOOGLE_CLOUD_LOCATION` | Vertex region (`us-central1`) |
| `ALLOWED_ORIGINS` | CORS origins, comma-separated or `*` |

**`mobile/.env`**: `EXPO_PUBLIC_API_URL` (FastAPI base; emulator `http://10.0.2.2:8000`).

---

## Database (current state)

| table | RLS | notes |
|---|---|---|
| `products` | on · public read | **embedding `vector(768)` populated for all 80 (Phase 3)** |
| `platform_prices` | on · public read | unique `(product_id, platform)` |
| `price_history` | on · public read | created by 0002 |
| `users` | on · owner-only (`auth.uid()`) | FK → `auth.users` · 0002 |
| `user_cart` | on · owner-only | 0002 |
| `user_preferences` | on · owner-only | 0002 |

`0001` + `0002` applied. `0003` (HNSW cosine index + `match_products` RPC) is
written — **run its SQL in the SQL Editor** to enable the indexed search path.
Until then the matcher uses an in-memory cosine fallback (correct, fine for 80
items), so `/search` already works.

---

## Status

### ✅ Phase 1 — Foundation (DONE)
Monorepo scaffold; Expo Home pings FastAPI `/health` → Supabase. AI switched to
Vertex AI (service-account auth). Migration 0001 applied.

### ✅ Phase 2 — Data layer (DONE)
- Migration `0002`: `users`, `user_cart`, `price_history`, `user_preferences`,
  natural-key index; RLS enabled on **every** table with commented policies
  (public read on catalog tables; owner-only via `auth.uid()` on user tables).
  *(Apply 0002 SQL in the dashboard to materialise the new tables.)*
- `seed/data/catalog.json`: 80 real Indian items across 8 categories
  (Dairy 10, Snacks 10, Beverages 8, Coffee/Tea 7, Staples 12, Instant 8,
  Bakery 7, Personal Care 8, Household 10), real brands, varied per-platform
  prices, per-platform delivery params, 6 items unavailable on one platform.
- `seed/seed_catalog.py`: idempotent (select-or-insert products; upsert prices on
  `(product_id, platform)`). **Verified run: 80 products, 240 price rows, 6
  unavailable; re-run inserts 0.** Embeddings left NULL.
- `GET /products` (paginated, typed; prices embedded via PostgREST). Verified
  `total=80`, unavailability flows through.
- `supabase-py` bumped to `2.31.0` (older versions reject the new `sb_secret_` key).

### ✅ Phase 3 — Embeddings & product matcher (DONE)
- `gemini.embed_texts()` on Vertex (`gemini-embedding-001`, 768d, batched +
  exponential backoff, **L2-normalized** since 768d output isn't pre-normalized)
  and `gemini.same_product()` (gemini-2.5-flash yes/no tie-break).
- `seed/embed_products.py`: idempotent backfill (`--force` to redo). **Verified:
  80 updated, 0 NULL, dim 768.** Writes pgvector literal strings over PostgREST.
- Migration `0003`: HNSW `vector_cosine_ops` index + `match_products(query, k)` RPC.
- `services/matcher.py`: `search(q, k)` and `match_external_product(name, brand,
  quantity)`. NN search prefers the RPC, falls back to in-memory cosine.
  Thresholds: accept ≥ 0.88, Gemini band 0.75–0.88, reject < 0.75; search floor
  0.60 (calibrated: junk queries top ~0.58, real ones 0.65+).
- `GET /search?q=&k=`: typed `SearchResponse` — each match has product +
  platform_prices + `best_option` (cheapest platform, savings vs costliest,
  fastest platform/time). Empty matches on no-good-match. **Verified:** coffee →
  Bru/Nescafe; "maggi noodles small packet" → Maggi 2-Min; "amul milk 1L" → Amul
  milk; gibberish → 0. External: "Amul Milk Toned Pouch" → Amul Toned Milk.

### ✅ Phase 4 — Core app UI (DONE)
- **Design system** (`tailwind.config.js` + `lib/theme.ts`): calm-commerce —
  light `surface-sunken` bg, ONE green `accent`, `ink` text ramp, hairline
  `line`, rounded `4xl` cards. Two fonts: **Inter** (text) + **Space Grotesk**
  (display/prices), each weight loaded via `useFonts` with splash hold. Platform
  colors used only as small dots.
- **Search screen** (`app/index.tsx`): debounced search bar (300ms, `/search`
  when ≥2 chars), category chips (filter the `/products` browse list when not
  searching), `ResultCard` `FlatList`, with loading-skeleton / empty / error
  states.
- **ResultCard**: glyph tile (category emoji — no image asset needed), name +
  brand·qty, price as the hero (display font), "⭐ BEST OPTION" + "Save ₹X"
  pills, winning platform dot, "⚡ N min". Tap → detail.
- **Product detail** (`app/product/[id].tsx`): green best-option hero (price,
  platform, savings, fastest) + 3 platforms side-by-side (`PlatformCompareCard`:
  price, delivery fee/threshold, ETA, stock); best ringed, fastest ⚡, out-of-
  stock greyed.
- **Wiring**: all data via React Query hooks → single `lib/api.ts`. No scattered
  fetch. `best_option` computed client-side (`lib/pricing.ts`) so browse + search
  + detail stay consistent.
- **Motion** (Reanimated): staggered `FadeInDown` list/section entrances
  (ease-out, capped), spring press-scale (`PressableScale`), one-shot badge
  emphasis — all gated by `useReducedMotion()`. No web/Framer.
- **Audit**: applied taste/motion/impeccable *principles* directly (those exact
  skills aren't invokable here). Fixed: no `className` on `Animated.View`
  (interop risk), type-safe `router.push` object form (typedRoutes), no
  duplicate iOS clear button. **Not rendered on a device by me** — see risks.
- New deps: `expo-font`, `expo-splash-screen`, `@expo-google-fonts/inter`,
  `@expo-google-fonts/space-grotesk`.

### ✅ Phase 5 — Cart + Cart Optimizer (DONE)
- **`optimizer.py`** (pure, unit-tested): enumerates the 7 non-empty platform
  subsets; per subset assigns each item to its cheapest *available* platform
  (tie-break by platform order), skips infeasible subsets; total = Σ(price×qty) +
  per-used-platform delivery fee, **waived when that platform's subtotal ≥ its
  free-delivery threshold**. Returns min-total split, single-best-platform total,
  savings, and `unavailable_items` (items out of stock everywhere are excluded,
  not fatal).
- **`POST /optimize`** (`routes/cart.py`, typed `OptimizeRequest`/`OptimizeResponse`):
  loads each cart product's prices, runs the optimizer, returns groups per
  platform (items, subtotal, delivery applied/waived, total) + grand total +
  savings. Verified: 422 on empty cart; live 5-item run produced a real
  Blinkit+Zepto split (both deliveries waived).
- **Unit tests** (`tests/test_optimizer.py`): split-beats-single (save ₹25),
  single-with-waiver-wins, quantity×unavailable. All pass.
- **Mobile**: Zustand `useCartStore` (add/inc/dec/remove/clear, count + qty
  selectors — client-only, **no persistence/auth, deferred to Phase 8**);
  `CartControl` (add ↔ stepper), `CartButton` (header badge), cart screen
  (`app/cart.tsx`) with rough total + "Optimize my cart", and `OptimizedSplit`
  (savings banner + per-platform groups, Reanimated staggered reveal). Add-to-cart
  on `ResultCard` + sticky bar on detail. All via `useOptimize` → `lib/api.ts`.

> ⚠️ Savings are modest with the current seed (Zepto ~uniformly cheapest, small
> spreads). The algorithm is correct (unit tests show larger wins). A more varied
> seed (different platforms cheapest per item) would make the wedge demo punchier.

### ⏭️ Next: Phase 6 — AI Shopping Assistant (WEDGE COMPLETE)
**Entry points:** `backend/app/ai/gemini.py` (`chat`), `backend/app/services/recommender.py`,
`backend/app/routes/assistant.py`, `mobile/` (assistant screen).
- Implement `gemini.chat()` on Vertex (`gemini-2.5-flash`).
- `recommender.py` + `POST /assistant`: take NL ("snacks under ₹300") + live
  catalog/prices as context → return a budget-fit basket with per-item platform +
  total. Reuse the optimizer for the split. Typed in/out.
- Mobile: assistant screen (prompt → basket result, "add all to cart").

---

## Roadmap (demoable wedge = Phases 1–6)
1. Foundation ✅
2. Data layer ✅
3. Embeddings & product matcher ✅
4. Core app UI ✅
5. Cart + Cart Optimizer ✅
5. Cart + Cart Optimizer — 7-subset cheapest split with delivery fees/thresholds, savings vs single platform
6. AI Shopping Assistant — `/assistant`, NL → budget basket (WEDGE COMPLETE)
7. Screenshot Cart Scanner — upload → Storage → `gemini-2.5-flash` vision → match → compare
8. Polish & extras — Auth (email + Google), price-history graphs, Realtime, analytics, OPTIONAL `collectors/` scrapers

### Design skills (Phase 4+, taste advisors only — NOT code generators)
`taste-skill`, `design-motion-principles`, `impeccable`. **HARD RULE:** these are
WEB skills; take only their principles (spacing, hierarchy, restraint, easing,
color, anti-slop). Translate everything to **NativeWind + Reanimated**. No CSS,
no `hover:`, no Framer Motion, no DOM. State what was translated in one line.

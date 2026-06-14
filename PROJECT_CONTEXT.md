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
│   │   ├── cart.tsx          # Cart list + Optimize → OptimizedSplit ← Phase 5
│   │   ├── assistant.tsx     # AI chat → basket + split + Add all ← Phase 6
│   │   └── scan.tsx          # screenshot upload → matched + split ← Phase 7
│   ├── components/           # ResultCard, PlatformCompareCard, SearchBar, CategoryChips,
│   │   │                     #   PressableScale, PlatformDot, StateViews,
│   │   │                     #   CartControl, CartButton, OptimizedSplit, ProductThumb
│   ├── lib/
│   │   ├── api.ts            # typed client: health/products/search/optimize/assistant/scan
│   │   ├── theme.ts          # tokens: accent, platform meta, emoji, motion, shadow
│   │   ├── pricing.ts        # computeBestOption + formatINR (mirrors backend)
│   │   ├── queryClient.ts
│   │   └── hooks/            # useProducts, useSearch, useDebounced, useOptimize, useAssistant, useScan
│   ├── store/useCartStore.ts # Zustand cart (client-only, +addQuantity) ← P5/P6
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
│   │   │   ├── assistant.py  # POST /assistant (AI budget basket) ← Phase 6
│   │   │   ├── vision.py     # POST /scan (screenshot scanner) ← Phase 7
│   │   │   └── user.py  # stub
│   │   ├── services/
│   │   │   ├── matcher.py    # cosine search + Gemini tie-break + candidates ← P3/P6
│   │   │   ├── optimizer.py  # 7-subset cheapest split ← Phase 5
│   │   │   ├── recommender.py  # AI basket pipeline ← Phase 6
│   │   │   └── scanner.py    # vision extract → match → optimize ← Phase 7
│   │   ├── ai/gemini.py      # embeds + chat + generate_json + vision ← P3/P6/P7
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
    ├── 0003_embedding_index_and_match_rpc.sql   # ⚠ run in dashboard (DDL)
    └── 0004_saved_baskets_history_auth.sql      # ⚠ run in dashboard (DDL) ← Phase 8
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
| `LIVE_PRICES_ENABLED` | Phase 9 live fetching (default `false` = serve seed) |
| `DEFAULT_PINCODE`/`DEFAULT_LAT`/`DEFAULT_LON` | collector location (Hyderabad default) |
| `PRICE_TTL_MINUTES`/`COLLECTOR_TIMEOUT_S` | cache TTL / per-collector timeout |

**`mobile/.env`**: `EXPO_PUBLIC_API_URL` (FastAPI base; USB `http://localhost:8000`),
`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (auth/realtime only —
**anon/publishable key, never service_role**; blank = guest mode).

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

**Storage:** bucket `cart-screenshots` (private) created — `/scan` uploads
screenshots there (best-effort). A `product-images` bucket is planned for
Phase 9 (mirroring live product images).

**Phase 8 DB (migration `0004`, run in dashboard):** `saved_baskets` (owner-only
RLS) for spending analytics; `handle_new_user` trigger (auto-creates `public.users`
on signup so FKs/RLS work); `log_price_change` trigger → writes `price_history`
on any `platform_prices.price` change; `platform_prices` set `REPLICA IDENTITY
FULL` + added to the `supabase_realtime` publication (so Realtime delivers
old.price). `price_history` backfilled with demo data via `seed/seed_price_history.py`.

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

### ✅ Phase 6 — AI Shopping Assistant (🎉 DEMOABLE WEDGE COMPLETE)
- `gemini.generate_json()` (structured output: `response_mime_type=application/json`
  + pydantic `response_schema`, lenient parse) and `gemini.chat()` on Vertex
  `gemini-2.5-flash`. `matcher.candidates()` = nearest slice without the floor.
- `recommender.recommend_basket()`: embed request → pgvector candidate slice (30) →
  Gemini proposes `{items, rationale}` constrained to candidate ids → **validate
  every id against the DB, drop hallucinations, clamp qty** → run through
  `optimizer.optimize()` for the real split → **budget mode** (greedily trim the
  costliest items, re-optimizing, until ≤ budget; report what was removed).
- `POST /assistant` (typed `AssistantRequest`/`AssistantResponse`: rationale,
  basket of `{product, quantity}`, full `optimization`, `within_budget`, `note`).
- Mobile: `app/assistant.tsx` (prompt + optional ₹budget + suggestion chips →
  rationale + basket + reused `OptimizedSplit` + "Add all to cart" → `addQuantity`
  into Zustand → cart). "Ask AI" entry on home. `useAssistant` hook, `api.assistant`.
- **End-to-end wedge check: ALL PASS** — search→best price→cart optimize→assistant
  (budget respected, real ids)→add all→re-optimize (totals match). First real
  `gemini-2.5-flash` generation calls on Vertex succeeded.

### ✅ Phase 7 — Screenshot Cart Scanner (DONE)
- `gemini.generate_json_from_image()` + `extract_cart_from_image()` —
  gemini-2.5-flash vision with structured JSON output (image part + schema).
- `services/scanner.py`: vision extract `{name, brand?, quantity?, price_seen?,
  platform_seen?}` → `matcher.match_external_product()` per line (drops/flags
  unmatched) → `optimizer.optimize()` on the matched basket → saving vs the
  screenshot's own prices.
- `POST /scan` (`routes/vision.py`): **multipart upload** (app→FastAPI only,
  honoring the locked convention — backend stores to Storage AND runs vision).
  Best-effort upload to Storage bucket **`cart-screenshots`** (created). Typed
  `ScanResponse` (extracted items + matched_product, basket, optimization,
  screenshot_total, savings_vs_screenshot, storage_path).
- Mobile: `app/scan.tsx` (expo-image-picker → multipart `/scan` → savings banner
  + extracted list with `ProductThumb` + reused `OptimizedSplit` + Add all),
  "📷 Scan a cart" entry on home, `useScan`, `api.scan`. `ProductThumb` uses
  **expo-image** (cached, fade-in) with category-glyph fallback (image_url null
  for now; real images come via Open Food Facts seed / Phase 9 collector).
- **Tested** on 3 rendered cart screenshots: **11/11 catalog items extracted +
  matched**, 1 non-catalog item correctly flagged unmatched; `/scan` HTTP route
  verified (3/3 matched, stored to bucket). *(Caveat: tests used clean rendered
  carts, not real app screenshots — real UI layouts are noisier.)*
- New deps: `python-multipart` (backend), `expo-image`, `expo-image-picker` (mobile).

### ✅ Phase 8 — Auth, history, realtime, analytics (DONE — code complete)
- **Auth** (`lib/supabase.ts` anon-key client, `lib/auth.tsx` AuthProvider):
  email sign-in/up + Google OAuth (PKCE via expo-auth-session/web-browser),
  session persistence (AsyncStorage), `app/auth.tsx` (dual sign-in/account).
  First direct mobile↔Supabase path — anon key only, never service_role.
- **Cart persistence** (`lib/hooks/useCartSync.ts`): on login, hydrate Zustand
  from `user_cart`; on change, debounced full-replace. Guest carts stay local.
- **Price history** (`GET /products/{id}/history`, `useProductHistory`,
  `components/PriceHistoryChart` via react-native-gifted-charts, `app/history/[id].tsx`)
  + history button on detail. Backfilled demo data; live writes via 0004 trigger.
- **Realtime** (`lib/hooks/usePriceWatch.ts`): subscribes to `platform_prices`
  UPDATEs → on price drop shows a toast (`components/Toaster`, `useNotifications`)
  and invalidates cached catalog so the UI updates live.
- **Analytics** (`app/analytics.tsx`): reads own `saved_baskets`, monthly spend +
  saved (LineChart), this-month + totals. "Mark as bought" in cart writes
  `saved_baskets`. Account button on home.
- Migration `0004` (saved_baskets + RLS, new-user trigger, price_history trigger,
  realtime). Deps: `@supabase/supabase-js`, async-storage, url-polyfill,
  expo-web-browser/auth-session, react-native-svg, react-native-gifted-charts.
- **Verified:** `tsc --noEmit` passes (0 errors); history endpoint live. **NOT
  yet runtime-verified** — needs anon key + dashboard config + a device (see below).

### ✅ Phase 9 — Live autonomous price engine (DONE — framework live, real collectors best-effort)
- `collectors/`: `base.py` (`ProductOffer`, `Collector` ABC, `CircuitBreaker`,
  errors), `engine.py` (`LiveEngine`: TTL query cache, concurrent fetch with
  per-collector timeout, graceful degradation, circuit breaker, global rate
  limit, DB-agnostic `on_offers` hook), `mock.py`, and real `blinkit.py` /
  `zepto.py` / `instamart.py` (httpx internal-API first → Playwright fallback).
- `services/live.py`: `process_offers` (matcher-map each offer → master or
  **create+embed new master** → upsert `platform_prices` with fresh `updated_at`;
  price_history via the 0004 trigger; best-effort image mirror to `product-images`)
  + `get_engine()` singleton.
- `/search` now async + **live-gated** (`LIVE_PRICES_ENABLED`, default OFF): when
  on, refreshes the query (per-platform `sources[].status` = live/cache/stale/
  error/skipped) then runs the same semantic search; **off by default so the
  Phase 1–8 wedge is unchanged**. App/AI code untouched — they still read only
  `platform_prices`.
- **Verified:** orchestration unit-validated with mocks (degradation, TTL,
  circuit breaker, bounded timeout); full pipeline proven end-to-end (mock offer →
  embedded master → upserted price → searchable). **Real collectors: all 3 are
  WAF/anti-bot blocked from server-side httpx** (Blinkit 403, Instamart 403,
  Zepto API gated) — they degrade to seed, which is the designed behavior. Live
  data needs the **Playwright fallback run on a residential machine** (not yet
  hardened). `product-images` bucket created. README documents run/config/ToS/reliability.

### 🏁 All 9 phases built. Remaining work is hardening, not new features:
- Harden the flakiest collector (Zepto first — most accessible) via Playwright on
  a residential connection: location/store resolution + real DOM selectors.
- Run pending dashboard migrations (`0003`, `0004`); supply mobile anon key +
  Google OAuth config; verify on a physical device (Expo Go) + RLS cross-user test.

---

## Roadmap (demoable wedge = Phases 1–6)
1. Foundation ✅
2. Data layer ✅
3. Embeddings & product matcher ✅
4. Core app UI ✅
5. Cart + Cart Optimizer ✅
6. AI Shopping Assistant ✅ — 🎉 **DEMOABLE WEDGE COMPLETE (Phases 1–6)**
7. Screenshot Cart Scanner ✅
8. Auth, History, Realtime & Analytics ✅
9. Live Autonomous Price Engine ✅ — framework live; real collectors best-effort (browser fallback pending)
5. Cart + Cart Optimizer — 7-subset cheapest split with delivery fees/thresholds, savings vs single platform
6. AI Shopping Assistant — `/assistant`, NL → budget basket (WEDGE COMPLETE)
7. Screenshot Cart Scanner — upload → Storage → `gemini-2.5-flash` vision → match → compare
8. Polish & extras — Auth (email + Google), price-history graphs, Realtime, analytics, OPTIONAL `collectors/` scrapers

### Design skills (Phase 4+, taste advisors only — NOT code generators)
`taste-skill`, `design-motion-principles`, `impeccable`. **HARD RULE:** these are
WEB skills; take only their principles (spacing, hierarchy, restraint, easing,
color, anti-slop). Translate everything to **NativeWind + Reanimated**. No CSS,
no `hover:`, no Framer Motion, no DOM. State what was translated in one line.

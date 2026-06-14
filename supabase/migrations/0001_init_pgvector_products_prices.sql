-- ============================================================================
-- BasketIQ migration 0001 — Foundation (Phase 1)
-- Enables pgvector and creates the two read-public catalog tables.
-- The rest of the schema (users, user_cart, price_history, user_preferences,
-- RLS on user-scoped tables) arrives in Phase 2.
-- ============================================================================

-- pgvector for product embeddings (gemini-embedding-001, 768 dims).
create extension if not exists vector;

-- ---- products -------------------------------------------------------------
-- Platform-agnostic product catalog. Prices live in platform_prices so the app
-- and AI never assume where price data comes from.
create table if not exists public.products (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    brand       text,
    category    text,
    quantity    text,                 -- e.g. "500 g", "1 L", "6 pcs"
    image_url   text,
    embedding   vector(768),          -- populated in Phase 3
    created_at  timestamptz not null default now()
);

-- ---- platform_prices ------------------------------------------------------
-- One row per (product, platform). Single source of truth for pricing.
create table if not exists public.platform_prices (
    id                      uuid primary key default gen_random_uuid(),
    product_id              uuid not null references public.products(id) on delete cascade,
    platform                text not null check (platform in ('blinkit', 'zepto', 'instamart')),
    price                   numeric(10, 2) not null,
    delivery_fee            numeric(10, 2) not null default 0,
    free_delivery_threshold numeric(10, 2),
    delivery_time_mins      integer,
    availability            boolean not null default true,
    updated_at              timestamptz not null default now(),
    unique (product_id, platform)
);

create index if not exists idx_platform_prices_product on public.platform_prices (product_id);
create index if not exists idx_platform_prices_platform on public.platform_prices (platform);

-- ---- Public read access (demo) --------------------------------------------
-- These catalog tables are public-read. RLS is enabled with a read-only policy;
-- writes happen server-side via the service_role key (which bypasses RLS).
alter table public.products enable row level security;
alter table public.platform_prices enable row level security;

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
    for select using (true);

drop policy if exists "platform_prices public read" on public.platform_prices;
create policy "platform_prices public read" on public.platform_prices
    for select using (true);

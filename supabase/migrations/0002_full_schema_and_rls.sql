-- ============================================================================
-- BasketIQ migration 0002 — Full schema + RLS (Phase 2)
-- Builds on 0001 (products, platform_prices). Adds the user-scoped tables and
-- price_history, and locks down RLS across the whole schema.
--
-- RLS model:
--   * products, platform_prices, price_history  -> PUBLIC READ (demo catalog).
--     Writes happen server-side via the service_role key, which BYPASSES RLS,
--     so no insert/update policies are needed for them.
--   * users, user_cart, user_preferences        -> PRIVATE, owner-only via
--     auth.uid(). A signed-in user can only see/modify their own rows.
-- ============================================================================

-- ---- users ----------------------------------------------------------------
-- App-level profile, keyed to the Supabase Auth user (auth.users.id).
create table if not exists public.users (
    id          uuid primary key references auth.users(id) on delete cascade,
    name        text,
    email       text,
    location    text,
    created_at  timestamptz not null default now()
);

-- ---- user_cart ------------------------------------------------------------
create table if not exists public.user_cart (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    product_id  uuid not null references public.products(id) on delete cascade,
    quantity    integer not null default 1 check (quantity > 0),
    created_at  timestamptz not null default now(),
    unique (user_id, product_id)
);
create index if not exists idx_user_cart_user on public.user_cart (user_id);

-- ---- price_history --------------------------------------------------------
-- Append-only log of price changes per (product, platform). Catalog data, so
-- it is public-read like products/platform_prices.
create table if not exists public.price_history (
    id          uuid primary key default gen_random_uuid(),
    product_id  uuid not null references public.products(id) on delete cascade,
    platform    text not null check (platform in ('blinkit', 'zepto', 'instamart')),
    old_price   numeric(10, 2),
    new_price   numeric(10, 2),
    date        timestamptz not null default now()
);
create index if not exists idx_price_history_product on public.price_history (product_id);

-- ---- user_preferences -----------------------------------------------------
create table if not exists public.user_preferences (
    user_id             uuid primary key references public.users(id) on delete cascade,
    favorite_products   jsonb not null default '[]'::jsonb,
    budget_range        text,
    preferred_platform  text check (preferred_platform in ('blinkit', 'zepto', 'instamart'))
);

-- ---- Integrity: natural key for idempotent catalog seeding -----------------
-- Lets the seeder upsert products on (name, brand, quantity). The Phase 2
-- seed script is also resilient without this (select-or-insert), but the
-- constraint prevents accidental duplicates from any writer.
create unique index if not exists uq_products_natural_key
    on public.products (name, brand, quantity);

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- ---- products: public read (re-affirm from 0001) --------------------------
alter table public.products enable row level security;
drop policy if exists "products public read" on public.products;
-- Anyone (anon or authed) may read the catalog.
create policy "products public read" on public.products
    for select using (true);

-- ---- platform_prices: public read (re-affirm from 0001) -------------------
alter table public.platform_prices enable row level security;
drop policy if exists "platform_prices public read" on public.platform_prices;
create policy "platform_prices public read" on public.platform_prices
    for select using (true);

-- ---- price_history: public read -------------------------------------------
alter table public.price_history enable row level security;
drop policy if exists "price_history public read" on public.price_history;
-- Price trends are catalog data; readable by everyone. Writes are server-side.
create policy "price_history public read" on public.price_history
    for select using (true);

-- ---- users: owner-only ----------------------------------------------------
alter table public.users enable row level security;
-- A user may read only their own profile row (id == their auth uid).
drop policy if exists "users select own" on public.users;
create policy "users select own" on public.users
    for select using (auth.uid() = id);
-- A user may create their own profile row (id must be their own uid).
drop policy if exists "users insert own" on public.users;
create policy "users insert own" on public.users
    for insert with check (auth.uid() = id);
-- A user may update only their own profile.
drop policy if exists "users update own" on public.users;
create policy "users update own" on public.users
    for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- user_cart: owner-only ------------------------------------------------
alter table public.user_cart enable row level security;
-- Every operation is scoped to rows the caller owns (user_id == auth uid).
drop policy if exists "user_cart select own" on public.user_cart;
create policy "user_cart select own" on public.user_cart
    for select using (auth.uid() = user_id);
drop policy if exists "user_cart insert own" on public.user_cart;
create policy "user_cart insert own" on public.user_cart
    for insert with check (auth.uid() = user_id);
drop policy if exists "user_cart update own" on public.user_cart;
create policy "user_cart update own" on public.user_cart
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_cart delete own" on public.user_cart;
create policy "user_cart delete own" on public.user_cart
    for delete using (auth.uid() = user_id);

-- ---- user_preferences: owner-only -----------------------------------------
alter table public.user_preferences enable row level security;
drop policy if exists "user_preferences select own" on public.user_preferences;
create policy "user_preferences select own" on public.user_preferences
    for select using (auth.uid() = user_id);
drop policy if exists "user_preferences insert own" on public.user_preferences;
create policy "user_preferences insert own" on public.user_preferences
    for insert with check (auth.uid() = user_id);
drop policy if exists "user_preferences update own" on public.user_preferences;
create policy "user_preferences update own" on public.user_preferences
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

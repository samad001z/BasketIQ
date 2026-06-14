-- ============================================================================
-- BasketIQ migration 0004 — auth glue + price-history trigger + saved baskets
-- (Phase 8). Run this SQL in the Supabase SQL Editor (DDL).
-- ============================================================================

-- ---- Auto-create a public.users row for every new auth user ----------------
-- user_cart / user_preferences / saved_baskets FK to public.users(id); this
-- keeps that row in sync with auth.users so RLS (auth.uid() = id) works.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---- Price-history logging --------------------------------------------------
-- Every time a platform_prices.price actually changes (seed update now, live
-- collector in Phase 9), append a price_history row. Powers the trend graph.
create or replace function public.log_price_change()
returns trigger
language plpgsql
as $$
begin
    if (new.price is distinct from old.price) then
        insert into public.price_history (product_id, platform, old_price, new_price)
        values (new.product_id, new.platform, old.price, new.price);
    end if;
    return new;
end;
$$;

drop trigger if exists trg_log_price_change on public.platform_prices;
create trigger trg_log_price_change
    after update on public.platform_prices
    for each row execute function public.log_price_change();

-- ---- Realtime for live price updates ---------------------------------------
-- Deliver full old/new rows to Realtime subscribers (so old.price is present
-- for "price drop" detection), and publish the table on the realtime channel.
alter table public.platform_prices replica identity full;
do $$
begin
    alter publication supabase_realtime add table public.platform_prices;
exception
    when duplicate_object then null;  -- already in the publication
end $$;

-- ---- saved_baskets: a "I bought this" record for spending analytics --------
create table if not exists public.saved_baskets (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    items       jsonb not null default '[]'::jsonb,  -- [{product_id,name,quantity,platform,price}]
    total       numeric(10, 2) not null,
    savings     numeric(10, 2) not null default 0,
    bought_at   timestamptz not null default now()
);
create index if not exists idx_saved_baskets_user on public.saved_baskets (user_id, bought_at);

-- ---- RLS: saved_baskets are owner-only -------------------------------------
alter table public.saved_baskets enable row level security;
drop policy if exists "saved_baskets select own" on public.saved_baskets;
create policy "saved_baskets select own" on public.saved_baskets
    for select using (auth.uid() = user_id);
drop policy if exists "saved_baskets insert own" on public.saved_baskets;
create policy "saved_baskets insert own" on public.saved_baskets
    for insert with check (auth.uid() = user_id);
drop policy if exists "saved_baskets delete own" on public.saved_baskets;
create policy "saved_baskets delete own" on public.saved_baskets
    for delete using (auth.uid() = user_id);

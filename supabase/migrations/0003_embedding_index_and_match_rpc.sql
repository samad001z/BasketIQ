-- ============================================================================
-- BasketIQ migration 0003 — pgvector index + match RPC (Phase 3)
-- Adds an HNSW cosine index over products.embedding and a server-side
-- nearest-neighbour function the matcher calls via RPC.
--
-- NOTE: the matcher works WITHOUT this migration (it falls back to an in-memory
-- cosine scan, fine for ~80 products). Applying this enables the indexed,
-- scalable path. Run this SQL in the Supabase SQL Editor (DDL).
-- ============================================================================

-- HNSW index for cosine distance (<=>). Built on the 768-d embedding column.
create index if not exists idx_products_embedding_hnsw
    on public.products using hnsw (embedding vector_cosine_ops);

-- Nearest products to a query embedding. Returns cosine similarity in [−1, 1]
-- (1 = identical). Vectors are unit-normalized on write, so cosine == dot.
create or replace function public.match_products(
    query_embedding vector(768),
    match_count int default 10
)
returns table (
    id uuid,
    name text,
    brand text,
    category text,
    quantity text,
    similarity float
)
language sql
stable
as $$
    select
        p.id,
        p.name,
        p.brand,
        p.category,
        p.quantity,
        1 - (p.embedding <=> query_embedding) as similarity
    from public.products p
    where p.embedding is not null
    order by p.embedding <=> query_embedding
    limit match_count;
$$;

"""Backfill products.embedding with 768-d Gemini vectors (Vertex).

For each product, embeds "{name} {brand} {category} {quantity}" with task_type
RETRIEVAL_DOCUMENT and writes the unit vector into products.embedding.

Idempotent: only embeds rows where embedding IS NULL, unless --force re-embeds
all. Access goes through app/database/supabase.py.

Run (from backend/):
    python -m seed.embed_products          # only missing
    python -m seed.embed_products --force  # re-embed everything
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ai.gemini import embed_texts  # noqa: E402
from app.database.supabase import get_supabase  # noqa: E402


def product_text(p: dict) -> str:
    parts = [p.get("name"), p.get("brand"), p.get("category"), p.get("quantity")]
    return " ".join(str(x) for x in parts if x).strip()


def to_pgvector(vec: list[float]) -> str:
    """pgvector literal '[v1,v2,...]' — the reliable write format over PostgREST."""
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


def main(force: bool = False) -> None:
    sb = get_supabase()
    if sb is None:
        raise SystemExit("Supabase not configured (backend/.env).")

    q = sb.table("products").select("id,name,brand,category,quantity,embedding")
    if not force:
        q = q.is_("embedding", "null")
    rows = q.execute().data or []

    if not rows:
        print("Nothing to embed (all products already have embeddings). Use --force to redo.")
        return

    print(f"Embedding {len(rows)} product(s){' [FORCE]' if force else ''} ...")
    texts = [product_text(r) for r in rows]
    vectors = embed_texts(texts, task_type="RETRIEVAL_DOCUMENT")

    updated = 0
    for row, vec in zip(rows, vectors):
        sb.table("products").update({"embedding": to_pgvector(vec)}).eq(
            "id", row["id"]
        ).execute()
        updated += 1

    # Confirm none remain NULL.
    remaining = (
        sb.table("products")
        .select("id", count="exact", head=True)
        .is_("embedding", "null")
        .execute()
    )
    print("---- embed summary ----")
    print(f"updated         : {updated}")
    print(f"still NULL       : {remaining.count}")
    print(f"vector dimension : {len(vectors[0])}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)

"""Product matcher — pgvector cosine search + Gemini tie-break.

Two entry points:
  * search(query, k)            -> ranked catalog matches for a user query.
  * match_external_product(...) -> resolve a scraped listing to a master
                                   product_id (the path real collectors will use
                                   in Phase 8). Accept on high similarity, ask
                                   gemini-2.5-flash on borderline, reject on low.

Nearest-neighbour search prefers the server-side `match_products` RPC
(migration 0003). If that function isn't present yet, it falls back to an
in-memory cosine scan — correct and fine for the ~80-item catalog.
"""
from __future__ import annotations

import json

from app.ai.gemini import embed_text, same_product
from app.database.supabase import get_supabase

# Similarity thresholds for external-product resolution.
HIGH_SIM = 0.88  # >= accept outright
LOW_SIM = 0.75  # < reject outright; [LOW, HIGH) -> ask Gemini

# Floor for user search: below this, treat as "no good match". Calibrated for
# this catalog — irrelevant queries top out ~0.58, real queries sit at 0.65+.
SEARCH_MIN_SIM = 0.60


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _parse_embedding(raw) -> list[float] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):  # pgvector returns "[...]" over PostgREST
        return [float(x) for x in json.loads(raw)]
    return None


def _nearest(query_vec: list[float], k: int) -> list[dict]:
    """Return [{id, name, brand, category, quantity, similarity}] best-first."""
    sb = get_supabase()
    if sb is None:
        raise RuntimeError("Supabase not configured.")

    # Preferred path: server-side RPC (uses the HNSW index).
    try:
        resp = sb.rpc(
            "match_products", {"query_embedding": query_vec, "match_count": k}
        ).execute()
        if resp.data is not None:
            return resp.data
    except Exception:  # noqa: BLE001 - RPC missing/older project -> fall back
        pass

    # Fallback: in-memory cosine (vectors are unit-normalized, so dot == cosine).
    rows = (
        sb.table("products")
        .select("id,name,brand,category,quantity,embedding")
        .not_.is_("embedding", "null")
        .execute()
        .data
        or []
    )
    scored = []
    for r in rows:
        vec = _parse_embedding(r.get("embedding"))
        if vec is None:
            continue
        scored.append(
            {
                "id": r["id"],
                "name": r["name"],
                "brand": r["brand"],
                "category": r["category"],
                "quantity": r["quantity"],
                "similarity": _dot(query_vec, vec),
            }
        )
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:k]


def search(query: str, k: int = 10) -> list[dict]:
    """Embed the query (RETRIEVAL_QUERY) and return cosine-nearest products
    above SEARCH_MIN_SIM, best-first."""
    q = query.strip()
    if not q:
        return []
    query_vec = embed_text(q, task_type="RETRIEVAL_QUERY")
    matches = _nearest(query_vec, k)
    return [m for m in matches if m["similarity"] >= SEARCH_MIN_SIM]


def candidates(query: str, k: int = 30) -> list[dict]:
    """Nearest products for a query WITHOUT the search floor — a generous slice
    used as candidate context for the AI assistant (Phase 6)."""
    q = query.strip()
    if not q:
        return []
    return _nearest(embed_text(q, task_type="RETRIEVAL_QUERY"), k)


def match_external_product(
    name: str, brand: str | None = None, quantity: str | None = None
) -> str | None:
    """Resolve a scraped/external listing to a master product_id, or None.

    High similarity -> accept. Borderline -> Gemini yes/no. Low -> reject.
    """
    text = " ".join(str(x) for x in (name, brand, quantity) if x).strip()
    if not text:
        return None

    cand_vec = embed_text(text, task_type="RETRIEVAL_DOCUMENT")
    nearest = _nearest(cand_vec, 1)
    if not nearest:
        return None

    top = nearest[0]
    sim = top["similarity"]
    if sim >= HIGH_SIM:
        return top["id"]
    if sim < LOW_SIM:
        return None

    # Borderline band: let Gemini judge.
    master_desc = " ".join(
        str(x) for x in (top["name"], top["brand"], top["quantity"]) if x
    )
    return top["id"] if same_product(text, master_desc) else None

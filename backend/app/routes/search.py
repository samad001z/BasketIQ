"""/search — semantic product search with cross-platform price comparison.

Flow: q -> embed (RETRIEVAL_QUERY) -> cosine-nearest products (matcher) ->
fetch each product's platform_prices -> compute best_option. Typed response.
"""
from fastapi import APIRouter, HTTPException, Query

from app.database.supabase import get_supabase
from app.services import matcher
from app.utils.schemas import (
    BestOption,
    PlatformPriceOut,
    ProductOut,
    SearchMatch,
    SearchResponse,
)

router = APIRouter(prefix="/search", tags=["search"])


def _best_option(prices: list[PlatformPriceOut]) -> BestOption | None:
    """Cheapest available platform + fastest available platform + savings."""
    available = [p for p in prices if p.availability]
    if not available:
        return None
    cheapest = min(available, key=lambda p: p.price)
    costliest = max(available, key=lambda p: p.price)
    # fastest = smallest delivery time; unknown times sort last
    fastest = min(
        available,
        key=lambda p: (p.delivery_time_mins is None, p.delivery_time_mins or 0),
    )
    return BestOption(
        cheapest_platform=cheapest.platform,
        cheapest_price=cheapest.price,
        savings_vs_costliest=round(costliest.price - cheapest.price, 2),
        fastest_platform=fastest.platform,
        fastest_delivery_mins=fastest.delivery_time_mins,
    )


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    k: int = Query(10, ge=1, le=50),
) -> SearchResponse:
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        ranked = matcher.search(q, k=k)  # [{id, ..., similarity}]
    except Exception as exc:  # noqa: BLE001 - embedding/RPC failure
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}")

    if not ranked:
        return SearchResponse(query=q, count=0, matches=[])

    # Fetch full products + prices for the matched ids in one call.
    ids = [m["id"] for m in ranked]
    try:
        rows = (
            sb.table("products")
            .select("*, platform_prices(*)")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Supabase query failed: {exc}")

    by_id = {r["id"]: r for r in rows}
    sim_by_id = {m["id"]: m["similarity"] for m in ranked}

    matches: list[SearchMatch] = []
    for pid in ids:  # preserve similarity order
        row = by_id.get(pid)
        if row is None:
            continue
        product = ProductOut(**row)
        matches.append(
            SearchMatch(
                product=product,
                similarity=round(sim_by_id[pid], 4),
                best_option=_best_option(product.platform_prices),
            )
        )

    return SearchResponse(query=q, count=len(matches), matches=matches)

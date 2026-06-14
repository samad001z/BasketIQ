"""/products — paginated catalog read with per-platform prices embedded.

Phase 2 verification endpoint: confirms the seed worked and gives the mobile app
its catalog source. Reads through app/database/supabase.py only.
"""
from fastapi import APIRouter, HTTPException, Query

from app.database.supabase import get_supabase
from app.utils.schemas import (
    HistoryPoint,
    PlatformHistory,
    ProductHistoryResponse,
    ProductOut,
    ProductsResponse,
)

router = APIRouter(prefix="/products", tags=["products"])

PLATFORMS = ("blinkit", "zepto", "instamart")


@router.get("", response_model=ProductsResponse)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ProductsResponse:
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    offset = (page - 1) * page_size

    try:
        resp = (
            sb.table("products")
            # PostgREST embeds the FK-related platform_prices in one query.
            .select("*, platform_prices(*)", count="exact")
            .order("name")
            .range(offset, offset + page_size - 1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 - surface DB/query errors as 502
        raise HTTPException(status_code=502, detail=f"Supabase query failed: {exc}")

    rows = resp.data or []
    items = [ProductOut(**row) for row in rows]
    return ProductsResponse(
        page=page,
        page_size=page_size,
        total=resp.count or 0,
        count=len(items),
        items=items,
    )


@router.get("/{product_id}/history", response_model=ProductHistoryResponse)
def product_history(product_id: str) -> ProductHistoryResponse:
    """Price-over-time per platform (from price_history) + current prices.
    Public catalog data, so it's served via the API like the rest of the catalog.
    """
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    prod = (
        sb.table("products")
        .select("id,name,platform_prices(platform,price)")
        .eq("id", product_id)
        .limit(1)
        .execute()
        .data
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    product = prod[0]
    current = {pp["platform"]: pp["price"] for pp in product.get("platform_prices", [])}

    rows = (
        sb.table("price_history")
        .select("platform,new_price,date")
        .eq("product_id", product_id)
        .order("date")
        .execute()
        .data
        or []
    )

    history: list[PlatformHistory] = []
    for plat in PLATFORMS:
        points = [
            HistoryPoint(date=r["date"], price=r["new_price"])
            for r in rows
            if r["platform"] == plat
        ]
        if points or plat in current:
            history.append(
                PlatformHistory(platform=plat, points=points, current=current.get(plat))
            )
    return ProductHistoryResponse(
        product_id=product["id"], name=product["name"], history=history
    )

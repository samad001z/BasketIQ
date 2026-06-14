"""/products — paginated catalog read with per-platform prices embedded.

Phase 2 verification endpoint: confirms the seed worked and gives the mobile app
its catalog source. Reads through app/database/supabase.py only.
"""
from fastapi import APIRouter, HTTPException, Query

from app.database.supabase import get_supabase
from app.utils.schemas import ProductOut, ProductsResponse

router = APIRouter(prefix="/products", tags=["products"])


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

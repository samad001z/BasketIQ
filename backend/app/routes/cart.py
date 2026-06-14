"""/optimize — cheapest cross-platform split for a cart.

Cart lives client-side (Zustand); the client posts its contents here. No
user_cart persistence yet (deferred to Phase 8 with auth).
"""
from fastapi import APIRouter, HTTPException

from app.database.supabase import get_supabase
from app.services import optimizer
from app.utils.schemas import OptimizeRequest, OptimizeResponse

router = APIRouter(tags=["cart"])


def _load_cart_items(sb, req: OptimizeRequest) -> list[dict]:
    """Fetch each cart product's platform prices and shape for the optimizer."""
    ids = [i.product_id for i in req.items]
    rows = (
        sb.table("products")
        .select("id,name,brand,quantity,platform_prices(*)")
        .in_("id", ids)
        .execute()
        .data
        or []
    )
    by_id = {r["id"]: r for r in rows}

    items: list[dict] = []
    for ri in req.items:
        row = by_id.get(ri.product_id)
        if row is None:
            continue  # unknown id — skip (cart is sourced from the catalog)
        prices = {
            pp["platform"]: {
                "price": pp["price"],
                "delivery_fee": pp["delivery_fee"],
                "free_delivery_threshold": pp["free_delivery_threshold"],
                "availability": pp["availability"],
            }
            for pp in row.get("platform_prices", [])
        }
        items.append(
            {
                "product_id": row["id"],
                "name": row["name"],
                "brand": row.get("brand"),
                "quantity": ri.quantity,
                "prices": prices,
            }
        )
    return items


@router.post("/optimize", response_model=OptimizeResponse)
def optimize_cart(req: OptimizeRequest) -> OptimizeResponse:
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        items = _load_cart_items(sb, req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Supabase query failed: {exc}")

    if not items:
        raise HTTPException(status_code=404, detail="No matching products for cart")

    return OptimizeResponse(**optimizer.optimize(items))

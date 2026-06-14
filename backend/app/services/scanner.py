"""Screenshot cart scanner (Phase 7).

gemini-2.5-flash vision extracts the items from a cart screenshot as structured
JSON; each item is mapped to a master product via the Phase 3 matcher
(match_external_product); the confidently-matched basket is run through the
optimizer to show the cheapest split and the saving vs. what the screenshot
showed.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.ai import gemini
from app.database.supabase import get_supabase
from app.services import matcher, optimizer

SCAN_SYSTEM = (
    "You read grocery / quick-commerce (Blinkit, Zepto, Swiggy Instamart) cart "
    "or order screenshots and extract the line items. Return JSON only."
)

SCAN_PROMPT = (
    "Extract every distinct product line item from this cart screenshot. For each "
    "item give: name (the product name as shown), brand if visible, quantity/pack "
    "size if visible (e.g. '500 ml'), price_seen (the numeric INR price shown for "
    "that line, no symbol), and platform_seen (blinkit/zepto/instamart) if the app "
    "is identifiable. Ignore totals, delivery fees, taxes and promo lines. If a "
    "field is not visible, omit it."
)


class _ScanItem(BaseModel):
    name: str
    brand: str | None = None
    quantity: str | None = None
    price_seen: float | None = None
    platform_seen: str | None = None


class _ScanResult(BaseModel):
    items: list[_ScanItem]


def _shape_for_optimizer(row: dict, qty: int) -> dict:
    return {
        "product_id": row["id"],
        "name": row["name"],
        "brand": row.get("brand"),
        "quantity": qty,
        "prices": {
            pp["platform"]: {
                "price": pp["price"],
                "delivery_fee": pp["delivery_fee"],
                "free_delivery_threshold": pp["free_delivery_threshold"],
                "availability": pp["availability"],
            }
            for pp in row.get("platform_prices", [])
        },
    }


def scan_cart_image(image_bytes: bytes, mime_type: str) -> dict:
    sb = get_supabase()
    if sb is None:
        raise RuntimeError("Supabase not configured.")

    # 1. Vision extraction (structured JSON).
    raw = gemini.extract_cart_from_image(
        image_bytes,
        mime_type,
        prompt=SCAN_PROMPT,
        response_schema=_ScanResult,
        system=SCAN_SYSTEM,
    )
    extracted_raw = raw.get("items", []) if isinstance(raw, dict) else []

    # 2. Match each extracted line to a master product.
    extracted: list[dict] = []
    chosen: dict[str, int] = {}  # product_id -> qty (one per matched line)
    for it in extracted_raw:
        if not isinstance(it, dict) or not it.get("name"):
            continue
        pid = matcher.match_external_product(
            it.get("name"), it.get("brand"), it.get("quantity")
        )
        entry = {
            "name": it.get("name"),
            "brand": it.get("brand"),
            "quantity": it.get("quantity"),
            "price_seen": it.get("price_seen"),
            "platform_seen": (it.get("platform_seen") or None),
            "matched": pid is not None,
            "product_id": pid,
        }
        extracted.append(entry)
        if pid:
            chosen[pid] = chosen.get(pid, 0) + 1

    # 3. Fetch matched product rows (with prices) and optimize.
    rows = (
        sb.table("products")
        .select("*, platform_prices(*)")
        .in_("id", list(chosen.keys()))
        .execute()
        .data
        or []
    ) if chosen else []
    by_id = {r["id"]: r for r in rows}

    items = [_shape_for_optimizer(by_id[pid], qty) for pid, qty in chosen.items() if pid in by_id]
    result = optimizer.optimize(items)

    # Attach the matched product object to each extracted line for the UI.
    for entry in extracted:
        pid = entry.pop("product_id", None)
        entry["matched_product"] = by_id.get(pid) if pid else None

    basket = [
        {"product": by_id[pid], "quantity": qty}
        for pid, qty in chosen.items()
        if pid in by_id
    ]

    # 4. Saving vs. the screenshot's own prices.
    seen_prices = [
        e["price_seen"]
        for e in extracted
        if e["matched"] and e["price_seen"] is not None
    ]
    screenshot_total = round(sum(seen_prices), 2) if seen_prices else None
    savings = (
        round(max(screenshot_total - result["grand_total"], 0.0), 2)
        if screenshot_total is not None
        else None
    )

    matched_count = sum(1 for e in extracted if e["matched"])
    return {
        "extracted": extracted,
        "matched_count": matched_count,
        "unmatched_count": len(extracted) - matched_count,
        "basket": basket,
        "optimization": result,
        "screenshot_total": screenshot_total,
        "savings_vs_screenshot": savings,
    }

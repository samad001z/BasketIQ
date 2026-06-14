"""Seed the BasketIQ catalog into Supabase (products + platform_prices).

Reads seed/data/catalog.json and, for every product, writes one row per
platform (blinkit, zepto, instamart) with realistic, varied prices plus the
platform's delivery params. A handful of items are marked unavailable on one
platform to exercise availability logic.

Idempotent:
  * products      -> select-or-insert on the natural key (name, brand, quantity),
                     so re-running never duplicates (works with or without the
                     uq_products_natural_key index from migration 0002).
  * platform_prices -> upsert on the (product_id, platform) unique constraint
                     from migration 0001, so prices are refreshed in place.

Embeddings are left NULL (Phase 3 fills them).

Run (from backend/):  python -m seed.seed_catalog
Access is only through app/database/supabase.py per project convention.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Make the backend root importable when run directly (python seed/seed_catalog.py).
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.supabase import get_supabase  # noqa: E402

CATALOG_PATH = Path(__file__).resolve().parent / "data" / "catalog.json"
PLATFORMS = ("blinkit", "zepto", "instamart")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_or_create_product(sb, item: dict) -> str:
    """Return the product id, inserting the product row if it doesn't exist."""
    name, brand, quantity = item["name"], item.get("brand"), item.get("quantity")

    existing = (
        sb.table("products")
        .select("id")
        .eq("name", name)
        .eq("brand", brand)
        .eq("quantity", quantity)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    inserted = (
        sb.table("products")
        .insert(
            {
                "name": name,
                "brand": brand,
                "category": item.get("category"),
                "quantity": quantity,
                "image_url": item.get("image_url"),
                # embedding intentionally omitted -> stays NULL (Phase 3)
            }
        )
        .execute()
    )
    return inserted.data[0]["id"]


def main() -> None:
    sb = get_supabase()
    if sb is None:
        raise SystemExit(
            "Supabase not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in backend/.env."
        )

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    delivery = catalog["platform_delivery"]
    products = catalog["products"]

    n_inserted = 0
    n_existing = 0
    n_price_rows = 0
    n_unavailable = 0

    for item in products:
        before = (
            sb.table("products")
            .select("id")
            .eq("name", item["name"])
            .eq("brand", item.get("brand"))
            .eq("quantity", item.get("quantity"))
            .limit(1)
            .execute()
        )
        is_new = not before.data
        product_id = get_or_create_product(sb, item)
        if is_new:
            n_inserted += 1
        else:
            n_existing += 1

        unavailable = set(item.get("unavailable", []))
        price_rows = []
        for platform in PLATFORMS:
            available = platform not in unavailable
            if not available:
                n_unavailable += 1
            d = delivery[platform]
            price_rows.append(
                {
                    "product_id": product_id,
                    "platform": platform,
                    "price": item["prices"][platform],
                    "delivery_fee": d["delivery_fee"],
                    "free_delivery_threshold": d["free_delivery_threshold"],
                    "delivery_time_mins": d["delivery_time_mins"],
                    "availability": available,
                    "updated_at": _now(),
                }
            )

        sb.table("platform_prices").upsert(
            price_rows, on_conflict="product_id,platform"
        ).execute()
        n_price_rows += len(price_rows)

    print("---- BasketIQ seed summary ----")
    print(f"products inserted : {n_inserted}")
    print(f"products existing : {n_existing}")
    print(f"products total    : {n_inserted + n_existing}")
    print(f"price rows upserted: {n_price_rows}")
    print(f"unavailable rows  : {n_unavailable}")


if __name__ == "__main__":
    main()

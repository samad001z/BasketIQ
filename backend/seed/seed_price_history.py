"""Seed synthetic price_history so the Phase 8 trend graph has data.

Generates ~8 weekly points per platform for a slice of products, trending down
to today's seeded price (a believable "prices came down" series). Idempotent:
deletes existing history for each product before re-inserting.

In production these rows are written automatically by the 0004 trigger whenever
platform_prices.price changes. This is just demo backfill.

Run (from backend/): python -m seed.seed_price_history
"""
from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.supabase import get_supabase  # noqa: E402

WEEKS = 8
N_PRODUCTS = 15


def main() -> None:
    sb = get_supabase()
    if sb is None:
        raise SystemExit("Supabase not configured (backend/.env).")

    products = (
        sb.table("products")
        .select("id,name,platform_prices(platform,price)")
        .order("name")
        .limit(N_PRODUCTS)
        .execute()
        .data
        or []
    )

    now = datetime.now(timezone.utc)
    total = 0
    for p in products:
        pid = p["id"]
        sb.table("price_history").delete().eq("product_id", pid).execute()
        rows = []
        for pp in p.get("platform_prices", []):
            plat = pp["platform"]
            current = float(pp["price"])
            rng = random.Random(hash((pid, plat)) & 0xFFFFFFFF)
            prev = None
            for w in range(WEEKS):
                # historical weeks sit 0–22% above current; last point == current.
                factor = 1.0 if w == WEEKS - 1 else round(1.0 + rng.uniform(0.0, 0.22), 3)
                price = round(current * factor, 2)
                date = (now - timedelta(weeks=(WEEKS - 1 - w))).isoformat()
                rows.append(
                    {
                        "product_id": pid,
                        "platform": plat,
                        "old_price": prev,
                        "new_price": price,
                        "date": date,
                    }
                )
                prev = price
        if rows:
            sb.table("price_history").insert(rows).execute()
            total += len(rows)

    print(f"Seeded {total} price_history rows across {len(products)} products "
          f"({WEEKS} weekly points × 3 platforms each).")


if __name__ == "__main__":
    main()

"""Populate products.image_url with real product photos from Open Food Facts.

Free API (https://world.openfoodfacts.org). Coverage for Indian packaged goods is
partial; products with no match keep image_url NULL and the app shows a premium
category fallback tile. Respectful: low rate + descriptive UA.

Run (from backend/): python -m seed.seed_images        (only missing)
                     python -m seed.seed_images --force (re-fetch all)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.supabase import get_supabase  # noqa: E402

UA = "BasketIQ/0.1 (portfolio project; contact: dev@basketiq.app)"
SEARCH = "https://world.openfoodfacts.org/cgi/search.pl"


def find_image(client: httpx.Client, name: str, brand: str | None) -> str | None:
    terms = " ".join(x for x in (brand, name) if x)
    try:
        r = client.get(
            SEARCH,
            params={
                "search_terms": terms,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": 1,
                "fields": "image_front_url,image_url",
            },
            headers={"User-Agent": UA},
            timeout=12.0,
        )
        if r.status_code != 200:
            return None
        prods = r.json().get("products", [])
        if not prods:
            return None
        p = prods[0]
        return p.get("image_front_url") or p.get("image_url")
    except Exception:  # noqa: BLE001
        return None


def main(force: bool = False) -> None:
    sb = get_supabase()
    if sb is None:
        raise SystemExit("Supabase not configured.")

    q = sb.table("products").select("id,name,brand,image_url")
    if not force:
        q = q.is_("image_url", "null")
    rows = q.execute().data or []
    if not rows:
        print("All products already have images. Use --force to refetch.")
        return

    found = 0
    with httpx.Client() as client:
        for r in rows:
            url = find_image(client, r["name"], r.get("brand"))
            if url:
                sb.table("products").update({"image_url": url}).eq("id", r["id"]).execute()
                found += 1
                print(f"  ✓ {r['brand']} {r['name']}")
            else:
                print(f"  · {r['brand']} {r['name']} (no match)")
            time.sleep(0.4)  # be gentle on OFF

    print(f"\n{found}/{len(rows)} products got a real image; the rest use the fallback tile.")


if __name__ == "__main__":
    main(force="--force" in sys.argv)

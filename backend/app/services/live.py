"""Live price service — wires real collectors to the orchestration engine and
turns live offers into platform_prices rows (matcher-mapped or new masters).

The app/AI never call this directly; it only feeds platform_prices, which the
rest of the system already reads. Seed data remains the fallback.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache

from app.ai import gemini
from app.config import get_settings
from app.database.supabase import get_supabase
from app.services import matcher
from collectors.base import ProductOffer
from collectors.blinkit import BlinkitCollector
from collectors.engine import LiveEngine
from collectors.instamart import InstamartCollector
from collectors.zepto import ZeptoCollector

IMAGE_BUCKET = "product-images"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_pgvector(vec: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


def _mirror_image(sb, image_url: str | None, product_id: str) -> str | None:
    """Best-effort: copy a remote image into Storage to avoid hotlink expiry.
    Returns the public URL, or the original url on any failure."""
    if not image_url:
        return image_url
    try:
        import httpx

        with httpx.Client(timeout=6.0) as c:
            resp = c.get(image_url)
        if resp.status_code != 200:
            return image_url
        path = f"{product_id}.jpg"
        sb.storage.from_(IMAGE_BUCKET).upload(
            path, resp.content, {"content-type": "image/jpeg", "upsert": "true"}
        )
        return sb.storage.from_(IMAGE_BUCKET).get_public_url(path)
    except Exception:  # noqa: BLE001 - mirroring is optional
        return image_url


def _create_master(sb, offer: ProductOffer) -> str:
    """Embed + insert a new master product for an unmatched live offer."""
    text = " ".join(
        str(x) for x in (offer.name, offer.brand, offer.quantity) if x
    ).strip()
    vec = gemini.embed_text(text, task_type="RETRIEVAL_DOCUMENT")
    inserted = (
        sb.table("products")
        .insert(
            {
                "name": offer.name,
                "brand": offer.brand,
                "quantity": offer.quantity,
                "image_url": offer.image_url,
                "embedding": _to_pgvector(vec),
            }
        )
        .execute()
    )
    pid = inserted.data[0]["id"]
    if offer.image_url:
        public = _mirror_image(sb, offer.image_url, pid)
        if public and public != offer.image_url:
            sb.table("products").update({"image_url": public}).eq("id", pid).execute()
    return pid


def process_offers(platform: str, offers: list[ProductOffer]) -> int:
    """Map each offer to a master product (or create one), then upsert its
    platform_prices row with a fresh updated_at. The 0004 trigger logs
    price_history on change. Runs synchronously (low volume)."""
    sb = get_supabase()
    if sb is None:
        return 0
    rows = []
    for offer in offers:
        pid = matcher.match_external_product(offer.name, offer.brand, offer.quantity)
        if pid is None:
            try:
                pid = _create_master(sb, offer)
            except Exception:  # noqa: BLE001 - skip an offer that won't insert
                continue
        rows.append(
            {
                "product_id": pid,
                "platform": platform,
                "price": offer.price,
                "delivery_fee": offer.delivery_fee or 0,
                "free_delivery_threshold": None,
                "delivery_time_mins": offer.delivery_time_mins,
                "availability": offer.availability,
                "updated_at": _now(),
            }
        )
    if rows:
        sb.table("platform_prices").upsert(rows, on_conflict="product_id,platform").execute()
    return len(rows)


@lru_cache
def get_engine() -> LiveEngine:
    s = get_settings()
    collectors = {
        "blinkit": BlinkitCollector(),
        "zepto": ZeptoCollector(),
        "instamart": InstamartCollector(),
    }
    return LiveEngine(
        collectors,
        ttl_s=s.PRICE_TTL_MINUTES * 60,
        timeout_s=s.COLLECTOR_TIMEOUT_S,
        on_offers=process_offers,
    )

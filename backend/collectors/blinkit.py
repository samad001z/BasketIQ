"""Blinkit collector. Internal layout-search API first, Playwright fallback.

Reality (probed): Blinkit returns 403 to server-side httpx even on `/` (WAF/
bot-management), so the API path is reliably blocked from a non-browser client.
The browser fallback (residential machine) is the only viable path, best-effort.
"""
from __future__ import annotations

import httpx

from app.config import get_settings
from collectors.base import (
    Collector,
    CollectorBlocked,
    CollectorUnavailable,
    ProductOffer,
)

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


class BlinkitCollector(Collector):
    name = "blinkit"

    async def fetch(self, query: str, pincode: str) -> list[ProductOffer]:
        try:
            return await self._via_api(query, pincode)
        except CollectorBlocked:
            return await self._via_browser(query, pincode)

    async def _via_api(self, query: str, pincode: str) -> list[ProductOffer]:
        s = get_settings()
        headers = {
            "user-agent": _UA,
            "accept": "*/*",
            "lat": s.DEFAULT_LAT,
            "lon": s.DEFAULT_LON,
            "app_client": "consumer_web",
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(
                timeout=s.COLLECTOR_TIMEOUT_S, follow_redirects=True
            ) as client:
                r = await client.get(
                    f"https://blinkit.com/v1/layout/search?q={query}", headers=headers
                )
        except httpx.HTTPError as e:
            raise CollectorBlocked(f"blinkit api transport: {e}") from e
        if r.status_code != 200 or "text/html" in r.headers.get("content-type", ""):
            raise CollectorBlocked(f"blinkit api blocked ({r.status_code})")
        return _parse_blinkit(r.json())

    async def _via_browser(self, query: str, pincode: str) -> list[ProductOffer]:
        try:
            from playwright.async_api import async_playwright  # noqa: F401  lazy
        except ImportError as e:
            raise CollectorUnavailable(
                "Playwright not installed (browser fallback disabled)."
            ) from e
        # Blinkit's bot-management often challenges headless Chromium too; a full
        # impl sets location via the pincode modal then scrapes product cards.
        raise CollectorUnavailable(
            "Blinkit browser fallback needs a hardened, non-headless session."
        )


def _parse_blinkit(data: dict) -> list[ProductOffer]:
    """Best-effort walk of Blinkit's layout 'snippets' for product cards."""
    offers: list[ProductOffer] = []
    snippets = (data.get("response") or {}).get("snippets", []) or data.get(
        "snippets", []
    )
    for sn in snippets:
        d = sn.get("data", {})
        name = (d.get("name") or {}).get("text") if isinstance(d.get("name"), dict) else d.get("name")
        price_obj = d.get("normal_price") or d.get("price") or {}
        price_txt = price_obj.get("text") if isinstance(price_obj, dict) else price_obj
        if name and price_txt:
            digits = "".join(c for c in str(price_txt) if c.isdigit() or c == ".")
            if digits:
                offers.append(ProductOffer(name=name, price=float(digits)))
    return offers

"""Swiggy Instamart collector. Internal search API first, Playwright fallback.

Reality (probed): the Instamart search API returns 403 to server-side httpx and
the SPA shell returns 202 with no data — the most locked-down of the three.
Browser fallback (residential machine) is the only viable path, best-effort.
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


class InstamartCollector(Collector):
    name = "instamart"

    async def fetch(self, query: str, pincode: str) -> list[ProductOffer]:
        try:
            return await self._via_api(query, pincode)
        except CollectorBlocked:
            return await self._via_browser(query, pincode)

    async def _via_api(self, query: str, pincode: str) -> list[ProductOffer]:
        s = get_settings()
        headers = {"user-agent": _UA, "accept": "application/json"}
        url = (
            "https://www.swiggy.com/api/instamart/search"
            f"?query={query}&pageNumber=0"
        )
        try:
            async with httpx.AsyncClient(
                timeout=s.COLLECTOR_TIMEOUT_S, follow_redirects=True
            ) as client:
                r = await client.get(url, headers=headers)
        except httpx.HTTPError as e:
            raise CollectorBlocked(f"instamart api transport: {e}") from e
        if r.status_code != 200 or not r.text:
            raise CollectorBlocked(f"instamart api blocked ({r.status_code})")
        return _parse_instamart(r.json())

    async def _via_browser(self, query: str, pincode: str) -> list[ProductOffer]:
        try:
            from playwright.async_api import async_playwright  # noqa: F401  lazy
        except ImportError as e:
            raise CollectorUnavailable(
                "Playwright not installed (browser fallback disabled)."
            ) from e
        raise CollectorUnavailable(
            "Instamart browser fallback needs cookies/location + anti-bot handling."
        )


def _parse_instamart(data: dict) -> list[ProductOffer]:
    offers: list[ProductOffer] = []
    cards = (((data.get("data") or {}).get("widgets")) or [])
    for w in cards:
        for it in (w.get("data") or {}).get("products", []) or []:
            v = (it.get("variations") or [{}])[0]
            name = it.get("display_name") or it.get("name")
            price = (v.get("price") or {}).get("offer_price") or (v.get("price") or {}).get(
                "mrp"
            )
            if name and price:
                offers.append(ProductOffer(name=name, price=float(price)))
    return offers

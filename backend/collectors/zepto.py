"""Zepto collector — the most accessible of the three (web responds 200).

Strategy: internal BFF JSON API first; Playwright (real browser) fallback when
the API path is blocked. Both are best-effort — Zepto gates search behind a
store_id derived from location and anti-bot tokens, so the httpx path is often
blocked and the browser path is the reliable one (run on a residential machine).
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


class ZeptoCollector(Collector):
    name = "zepto"

    async def fetch(self, query: str, pincode: str) -> list[ProductOffer]:
        try:
            return await self._via_api(query, pincode)
        except CollectorBlocked:
            return await self._via_browser(query, pincode)

    async def _via_api(self, query: str, pincode: str) -> list[ProductOffer]:
        s = get_settings()
        headers = {
            "user-agent": _UA,
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json",
            "app_sub_platform": "WEB",
            "platform": "WEB",
            "store_id": "",  # resolved from lat/lon in a full impl; left blank here
            "tenant": "zepto",
        }
        body = {
            "query": query,
            "pageNumber": 0,
            "userSessionId": "",
            "mode": "AUTOSUGGEST",
        }
        try:
            async with httpx.AsyncClient(timeout=s.COLLECTOR_TIMEOUT_S) as client:
                r = await client.post(
                    "https://api.zeptonow.com/api/v3/search", headers=headers, json=body
                )
        except httpx.HTTPError as e:
            # DNS / connect failures observed for the API host from some networks.
            raise CollectorBlocked(f"zepto api transport: {e}") from e
        if r.status_code in (401, 403, 429) or "text/html" in r.headers.get(
            "content-type", ""
        ):
            raise CollectorBlocked(f"zepto api blocked ({r.status_code})")
        return _parse_zepto(r.json())

    async def _via_browser(self, query: str, pincode: str) -> list[ProductOffer]:
        try:
            from playwright.async_api import async_playwright  # lazy, optional
        except ImportError as e:
            raise CollectorUnavailable(
                "Playwright not installed. `pip install -r collectors/requirements-collectors.txt`"
                " && `playwright install chromium` to enable the browser fallback."
            ) from e

        offers: list[ProductOffer] = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                ctx = await browser.new_context(user_agent=_UA, locale="en-IN")
                page = await ctx.new_page()
                # NOTE: real flow sets location to `pincode` via the location modal,
                # then searches. DOM selectors below are placeholders to harden live.
                await page.goto(
                    f"https://www.zeptonow.com/search?query={query}",
                    wait_until="domcontentloaded",
                    timeout=int(get_settings().COLLECTOR_TIMEOUT_S * 1000),
                )
                cards = await page.query_selector_all('[data-testid="product-card"]')
                for c in cards[:15]:
                    name = await _text(c, '[data-testid="product-card-name"]')
                    price = await _price(c, '[data-testid="product-card-price"]')
                    if name and price is not None:
                        offers.append(
                            ProductOffer(name=name, price=price, availability=True)
                        )
            finally:
                await browser.close()
        if not offers:
            raise CollectorBlocked("zepto browser returned no parseable cards")
        return offers


async def _text(card, sel: str) -> str | None:
    el = await card.query_selector(sel)
    return (await el.inner_text()).strip() if el else None


async def _price(card, sel: str) -> float | None:
    raw = await _text(card, sel)
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit() or ch == ".")
    try:
        return float(digits)
    except ValueError:
        return None


def _parse_zepto(data: dict) -> list[ProductOffer]:
    """Walk the BFF response for product objects (shape varies; defensive)."""
    offers: list[ProductOffer] = []
    layout = data.get("layout") or data.get("widgets") or []
    for widget in layout if isinstance(layout, list) else []:
        items = (widget.get("data") or {}).get("resolver", {}).get("data", {}).get(
            "items", []
        )
        for it in items or []:
            prod = it.get("productResponse", it)
            name = prod.get("name") or prod.get("productName")
            price = prod.get("sellingPrice") or prod.get("price")
            if name and price is not None:
                offers.append(
                    ProductOffer(
                        name=name,
                        price=float(price) / (100 if float(price) > 1000 else 1),
                        brand=prod.get("brand"),
                        quantity=prod.get("packSize") or prod.get("quantity"),
                        image_url=prod.get("imageUrl") or prod.get("image"),
                        availability=bool(prod.get("inStock", True)),
                    )
                )
    return offers

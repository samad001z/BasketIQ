"""Mock collector for validating orchestration without network/scraping."""
from __future__ import annotations

import asyncio

from collectors.base import Collector, CollectorBlocked, ProductOffer


class MockCollector(Collector):
    def __init__(
        self,
        name: str,
        *,
        mode: str = "ok",  # "ok" | "error" | "timeout"
        delay_s: float = 0.02,
        offers: list[ProductOffer] | None = None,
    ) -> None:
        self.name = name
        self.mode = mode
        self.delay_s = delay_s
        self._offers = offers

    async def fetch(self, query: str, pincode: str) -> list[ProductOffer]:
        if self.mode == "timeout":
            await asyncio.sleep(60)  # exceeds the engine timeout
            return []
        await asyncio.sleep(self.delay_s)
        if self.mode == "error":
            raise CollectorBlocked(f"{self.name}: simulated 403")
        if self._offers is not None:
            return self._offers
        return [
            ProductOffer(
                name=f"{query.title()} (mock)",
                brand="MockBrand",
                quantity="1 unit",
                price=round(20 + len(query) + len(self.name), 2),
                delivery_fee=20,
                delivery_time_mins=12,
                availability=True,
            )
        ]

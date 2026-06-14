"""Live orchestration engine — TTL cache, concurrent fetch, graceful degradation,
per-collector circuit breaker, global rate limit. Pure orchestration: it knows
nothing about the DB. Processing offers is delegated to an `on_offers` hook so the
whole flow is testable with mock collectors and no network/DB.
"""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Literal

from collectors.base import CircuitBreaker, Collector, CollectorError, ProductOffer

# Per-platform outcome for one refresh.
SourceStatus = Literal["live", "cache", "stale", "error", "skipped"]

# on_offers(platform, offers) -> count processed. May be sync or async.
OnOffers = Callable[[str, list[ProductOffer]], int | Awaitable[int]]


class RefreshReport:
    def __init__(self) -> None:
        self.platforms: dict[str, SourceStatus] = {}
        self.counts: dict[str, int] = {}
        self.from_cache: bool = False

    def as_dict(self) -> dict:
        return {
            "from_cache": self.from_cache,
            "platforms": self.platforms,
            "counts": self.counts,
        }


class LiveEngine:
    def __init__(
        self,
        collectors: dict[str, Collector],
        *,
        ttl_s: float = 1200.0,  # 20 min query cache
        timeout_s: float = 8.0,
        min_interval_s: float = 1.0,  # global rate limit between refresh batches
        on_offers: OnOffers | None = None,
        breaker_threshold: int = 3,
        breaker_cooldown_s: float = 300.0,
    ) -> None:
        self.collectors = collectors
        self.ttl_s = ttl_s
        self.timeout_s = timeout_s
        self.min_interval_s = min_interval_s
        self.on_offers = on_offers
        self._breakers = {
            name: CircuitBreaker(breaker_threshold, breaker_cooldown_s)
            for name in collectors
        }
        self._query_cache: dict[str, float] = {}  # (query|pincode) -> ts
        self._last_batch_ts = 0.0
        self._rate_lock = asyncio.Lock()

    def _key(self, query: str, pincode: str) -> str:
        return f"{query.strip().lower()}|{pincode}"

    def _fresh(self, query: str, pincode: str) -> bool:
        ts = self._query_cache.get(self._key(query, pincode))
        return ts is not None and (time.monotonic() - ts) < self.ttl_s

    async def _rate_limit(self) -> None:
        async with self._rate_lock:
            wait = self.min_interval_s - (time.monotonic() - self._last_batch_ts)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_batch_ts = time.monotonic()

    async def _process(self, platform: str, offers: list[ProductOffer]) -> int:
        if not self.on_offers or not offers:
            return 0
        res = self.on_offers(platform, offers)
        return await res if asyncio.iscoroutine(res) else res  # type: ignore[return-value]

    async def refresh(self, query: str, pincode: str) -> RefreshReport:
        report = RefreshReport()

        # Fresh query within TTL → serve from DB (no fetch). Mark all 'cache'.
        if self._fresh(query, pincode):
            report.from_cache = True
            report.platforms = {name: "cache" for name in self.collectors}
            return report

        await self._rate_limit()

        async def one(name: str, collector: Collector):
            if self._breakers[name].is_open():
                return name, "skipped", []
            try:
                offers = await asyncio.wait_for(
                    collector.fetch(query, pincode), timeout=self.timeout_s
                )
                self._breakers[name].record_success()
                return name, "live", offers
            except (CollectorError, asyncio.TimeoutError, Exception):
                self._breakers[name].record_failure()
                return name, "error", []

        results = await asyncio.gather(
            *(one(n, c) for n, c in self.collectors.items())
        )

        any_live = False
        for name, status, offers in results:
            if status == "live":
                any_live = True
                report.counts[name] = await self._process(name, offers)
            report.platforms[name] = status  # type: ignore[assignment]

        # Only refresh the query-cache timestamp if we actually got new data.
        if any_live:
            self._query_cache[self._key(query, pincode)] = time.monotonic()
        return report

"""Collector interface + shared offer model + circuit breaker.

A collector fetches live offers for ONE search query from ONE platform. The app
and AI never touch collectors — they only read platform_prices. Collectors are an
optional, best-effort writer into that table (with seed data as the fallback).
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod

from pydantic import BaseModel


class ProductOffer(BaseModel):
    """One live offer as returned by a platform for a query."""

    name: str
    price: float
    availability: bool = True
    brand: str | None = None
    quantity: str | None = None
    delivery_fee: float | None = None
    delivery_time_mins: int | None = None
    image_url: str | None = None


class CollectorError(Exception):
    """Generic collector failure (network/parse)."""


class CollectorBlocked(CollectorError):
    """Anti-bot block / 403 / captcha — treat as a hard, cool-downable failure."""


class CollectorUnavailable(CollectorError):
    """Collector not implemented yet / disabled."""


class Collector(ABC):
    """All platform collectors implement this."""

    name: str  # 'blinkit' | 'zepto' | 'instamart'

    @abstractmethod
    async def fetch(self, query: str, pincode: str) -> list[ProductOffer]:
        """Return live offers for `query` at `pincode`, or raise CollectorError."""
        raise NotImplementedError


class CircuitBreaker:
    """Skip a flaky collector after N consecutive failures for a cool-down."""

    def __init__(self, threshold: int = 3, cooldown_s: float = 300.0) -> None:
        self.threshold = threshold
        self.cooldown_s = cooldown_s
        self._failures = 0
        self._open_until = 0.0

    def is_open(self) -> bool:
        if self._open_until and time.monotonic() < self._open_until:
            return True
        if self._open_until and time.monotonic() >= self._open_until:
            self._open_until = 0.0  # cool-down elapsed → half-open
        return False

    def record_success(self) -> None:
        self._failures = 0
        self._open_until = 0.0

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self.threshold:
            self._open_until = time.monotonic() + self.cooldown_s

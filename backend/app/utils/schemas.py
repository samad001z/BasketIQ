"""Shared Pydantic v2 models. Every endpoint uses typed request/response models —
no raw dicts across the API boundary.

Phase 1 only needs health models. Search/cart/assistant models arrive in later
phases alongside their routes.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Platform(str, Enum):
    """The three quick-commerce platforms BasketIQ compares."""

    blinkit = "blinkit"
    zepto = "zepto"
    instamart = "instamart"


class DependencyStatus(BaseModel):
    """Status of one external dependency the API relies on."""

    name: str
    status: Literal["ok", "error", "not_configured"]
    detail: str | None = None


class HealthResponse(BaseModel):
    """Response for GET /health — the Phase 1 end-to-end ping target."""

    status: Literal["ok", "degraded"]
    service: str = "basketiq-backend"
    version: str = "0.1.0"
    timestamp: datetime = Field(default_factory=_utcnow)
    dependencies: list[DependencyStatus] = []


# ---- Catalog models (Phase 2) ---------------------------------------------
# These mirror the DB rows. Prices come back from PostgREST; `price` etc. may
# arrive as numeric strings, so floats are used (pydantic coerces).


class PlatformPriceOut(BaseModel):
    """One platform's pricing row for a product."""

    id: str
    platform: Platform
    price: float
    delivery_fee: float
    free_delivery_threshold: float | None = None
    delivery_time_mins: int | None = None
    availability: bool
    updated_at: datetime


class ProductOut(BaseModel):
    """A catalog product with its per-platform prices embedded."""

    id: str
    name: str
    brand: str | None = None
    category: str | None = None
    quantity: str | None = None
    image_url: str | None = None
    created_at: datetime
    # PostgREST embeds the related rows under the table name.
    platform_prices: list[PlatformPriceOut] = Field(default_factory=list)


class ProductsResponse(BaseModel):
    """Paginated response for GET /products."""

    page: int
    page_size: int
    total: int  # total products in the catalog
    count: int  # products returned on this page
    items: list[ProductOut]


# ---- Search models (Phase 3) ----------------------------------------------


class BestOption(BaseModel):
    """The recommended pick across available platforms for one product."""

    cheapest_platform: Platform
    cheapest_price: float
    savings_vs_costliest: float  # cheapest vs most expensive available platform
    fastest_platform: Platform
    fastest_delivery_mins: int | None = None


class SearchMatch(BaseModel):
    """One matched product with its prices and the computed best option."""

    product: ProductOut
    similarity: float
    best_option: BestOption | None = None  # None if nothing is in stock


class SearchResponse(BaseModel):
    """Response for GET /search."""

    query: str
    count: int
    matches: list[SearchMatch]


# ---- Cart optimizer models (Phase 5) --------------------------------------


class OptimizeRequestItem(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class OptimizeRequest(BaseModel):
    items: list[OptimizeRequestItem] = Field(min_length=1)


class OptimizedLineItem(BaseModel):
    product_id: str
    name: str
    brand: str | None = None
    quantity: int
    unit_price: float
    line_total: float


class PlatformGroup(BaseModel):
    """All cart items assigned to one platform in the optimized split."""

    platform: Platform
    items: list[OptimizedLineItem]
    subtotal: float
    delivery_fee: float  # the platform's base fee
    delivery_applied: float  # 0 if waived (subtotal >= threshold)
    delivery_waived: bool
    total: float  # subtotal + delivery_applied


class UnavailableItem(BaseModel):
    product_id: str
    name: str


class OptimizeResponse(BaseModel):
    """The cheapest cross-platform split for a cart."""

    split: list[PlatformGroup]
    grand_total: float
    single_best_platform: Platform | None = None
    single_best_total: float | None = None
    savings: float  # single_best_total - grand_total (>= 0); 0 if no single platform has all
    unavailable_items: list[UnavailableItem] = []
    item_count: int

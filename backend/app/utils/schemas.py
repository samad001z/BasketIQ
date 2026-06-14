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


class PlatformSource(BaseModel):
    """Per-platform freshness for a live search (Phase 9)."""

    platform: Platform
    status: Literal["live", "cache", "stale", "error", "skipped"]


class SearchResponse(BaseModel):
    """Response for GET /search."""

    query: str
    count: int
    matches: list[SearchMatch]
    live: bool = False  # whether a live fetch was attempted
    sources: list[PlatformSource] = []  # per-platform freshness (empty when not live)


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


# ---- AI assistant models (Phase 6) ----------------------------------------


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1)
    budget: float | None = Field(default=None, ge=0)


class AssistantBasketItem(BaseModel):
    product: ProductOut
    quantity: int


class AssistantResponse(BaseModel):
    """A budget-aware basket proposed by the AI, with the real optimized split."""

    message: str  # echo of the user's request
    rationale: str  # one-line explanation from the model
    budget: float | None = None
    within_budget: bool
    note: str | None = None  # e.g. what was trimmed to fit the budget
    basket: list[AssistantBasketItem]
    optimization: OptimizeResponse


# ---- Screenshot scanner models (Phase 7) ----------------------------------


class ScanExtractedItem(BaseModel):
    """One line the vision model read from the screenshot + its catalog match."""

    name: str
    brand: str | None = None
    quantity: str | None = None
    price_seen: float | None = None
    platform_seen: str | None = None
    matched: bool
    matched_product: ProductOut | None = None  # None if no confident match


class ScanResponse(BaseModel):
    extracted: list[ScanExtractedItem]
    matched_count: int
    unmatched_count: int
    basket: list[AssistantBasketItem]  # confidently matched products + qty
    optimization: OptimizeResponse
    screenshot_total: float | None = None  # Σ price_seen for matched items
    savings_vs_screenshot: float | None = None  # screenshot_total − optimized (≥ 0)
    storage_path: str | None = None


# ---- Price history models (Phase 8) ---------------------------------------


class HistoryPoint(BaseModel):
    date: datetime
    price: float


class PlatformHistory(BaseModel):
    platform: Platform
    points: list[HistoryPoint]  # oldest → newest
    current: float | None = None


class ProductHistoryResponse(BaseModel):
    product_id: str
    name: str
    history: list[PlatformHistory]

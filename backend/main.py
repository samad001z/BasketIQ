"""BasketIQ FastAPI entry point.

Run (dev): uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import assistant, cart, health, products, search, user, vision

settings = get_settings()

app = FastAPI(
    title="BasketIQ API",
    version="0.1.0",
    description="Cross-platform grocery price comparison + AI shopping assistant.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 1: only /health is functional. The rest are mounted as stubs so the
# route surface is stable and each phase fills in its own router.
app.include_router(health.router)
app.include_router(products.router)
app.include_router(search.router)
app.include_router(cart.router)
app.include_router(user.router)
app.include_router(assistant.router)
app.include_router(vision.router)


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {"service": "basketiq-backend", "docs": "/docs", "health": "/health"}

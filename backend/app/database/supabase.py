"""Supabase client (server-side, service_role). Lazily created so the API can
boot and report a clear 'not_configured' health status even without creds.
"""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings
from app.utils.schemas import DependencyStatus


@lru_cache
def get_supabase() -> Client | None:
    """Return a cached Supabase client, or None if creds are missing."""
    settings = get_settings()
    if not settings.supabase_configured:
        return None
    return create_client(
        settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
    )


def check_supabase() -> DependencyStatus:
    """Lightweight connectivity probe used by GET /health.

    Phase 1: counts rows in `products` (created by migration 0001). A reachable
    project with the table present returns 'ok'; a missing table still proves
    connectivity but is reported in detail.
    """
    settings = get_settings()
    if not settings.supabase_configured:
        return DependencyStatus(
            name="supabase",
            status="not_configured",
            detail="SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
        )

    client = get_supabase()
    assert client is not None  # guarded by supabase_configured

    try:
        # head=True -> no rows transferred, just the count. Cheapest probe.
        resp = client.table("products").select("id", count="exact", head=True).execute()
        count = resp.count if resp.count is not None else 0
        return DependencyStatus(
            name="supabase",
            status="ok",
            detail=f"connected; products rows={count}",
        )
    except Exception as exc:  # noqa: BLE001 - surface any connectivity/schema error
        return DependencyStatus(
            name="supabase",
            status="error",
            detail=f"{type(exc).__name__}: {exc}",
        )

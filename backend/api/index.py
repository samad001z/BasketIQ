"""Vercel serverless entry for the FastAPI app.

Deploy with Vercel "Root Directory" = `backend`. Vercel's @vercel/python serves
the exported `app` (ASGI). Live collectors must stay OFF on Vercel (datacenter
IP + no Playwright) — keep LIVE_PRICES_ENABLED unset/false there.

Vertex credentials are materialised by app.config from GOOGLE_CREDENTIALS_B64
(preferred) or GOOGLE_CREDENTIALS_JSON — set one of those in the host's env.
"""
import os
import sys

# Make `main` importable (api/ is one level below backend/).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402  (exposed to @vercel/python as the ASGI app)

__all__ = ["app"]

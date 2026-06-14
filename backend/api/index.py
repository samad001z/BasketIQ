"""Vercel serverless entry for the FastAPI app.

Deploy with Vercel "Root Directory" = `backend`. Vercel's @vercel/python serves
the exported `app` (ASGI). Live collectors must stay OFF on Vercel (datacenter
IP + no Playwright) — keep LIVE_PRICES_ENABLED unset/false there.
"""
import os
import pathlib
import sys

# Make `main` importable (api/ is one level below backend/).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Vertex service account: serverless has no committed file, so materialise the
# JSON from an env var (set GOOGLE_CREDENTIALS_JSON to the file's contents).
_creds = os.environ.get("GOOGLE_CREDENTIALS_JSON")
if _creds and not os.environ.get("_SA_WRITTEN"):
    path = "/tmp/sa-vertex.json"
    pathlib.Path(path).write_text(_creds)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = path
    os.environ["_SA_WRITTEN"] = "1"

from main import app  # noqa: E402  (exposed to @vercel/python as the ASGI app)

__all__ = ["app"]

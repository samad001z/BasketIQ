"""Centralised settings loaded from environment (.env). pydantic-settings v2."""
import os
import pathlib
import tempfile
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


def _materialize_vertex_credentials() -> None:
    """Host-agnostic Vertex auth. On cloud hosts there's no committed
    sa-vertex.json, so materialise it from an env var and point ADC at it:
      - GOOGLE_CREDENTIALS_B64  (preferred — single line, paste-safe), or
      - GOOGLE_CREDENTIALS_JSON (raw JSON; can break on multi-line paste).
    Only sets GOOGLE_APPLICATION_CREDENTIALS if the content is valid JSON, so a
    bad paste surfaces as 'not configured' instead of a mid-request crash.
    No-op locally (GOOGLE_APPLICATION_CREDENTIALS already points at the file)."""
    import base64
    import json

    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return

    content: str | None = None
    b64 = os.environ.get("GOOGLE_CREDENTIALS_B64")
    raw = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if b64:
        try:
            content = base64.b64decode(b64).decode("utf-8")
        except Exception:  # noqa: BLE001
            content = None
    elif raw:
        content = raw

    if not content:
        return
    try:
        json.loads(content)  # validate before trusting it
    except Exception:  # noqa: BLE001 - bad paste → leave Vertex unconfigured
        return

    path = pathlib.Path(tempfile.gettempdir()) / "sa-vertex.json"
    path.write_text(content, encoding="utf-8")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)


_materialize_vertex_credentials()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Supabase (server-side: service role)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Gemini via Vertex AI (service-account auth, GCP billing).
    # GOOGLE_APPLICATION_CREDENTIALS points to the SA JSON (sa-vertex.json).
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_LOCATION: str = "us-central1"

    # CORS
    ALLOWED_ORIGINS: str = "*"

    # --- Live price engine (Phase 9) ---
    # Off by default: /search serves the seeded catalog (the proven wedge).
    # Turn on to fetch live prices on demand (best-effort; seed stays as fallback).
    LIVE_PRICES_ENABLED: bool = False
    DEFAULT_PINCODE: str = "500081"  # Hyderabad (Gachibowli)
    DEFAULT_LAT: str = "17.4435"
    DEFAULT_LON: str = "78.3772"
    PRICE_TTL_MINUTES: int = 20
    COLLECTOR_TIMEOUT_S: float = 8.0

    @property
    def allowed_origins_list(self) -> list[str]:
        if self.ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_ROLE_KEY)

    @property
    def vertex_configured(self) -> bool:
        return bool(self.GOOGLE_CLOUD_PROJECT and self.GOOGLE_APPLICATION_CREDENTIALS)


@lru_cache
def get_settings() -> Settings:
    return Settings()

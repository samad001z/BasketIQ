"""Centralised settings loaded from environment (.env). pydantic-settings v2."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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

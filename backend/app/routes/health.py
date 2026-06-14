"""GET /health — the Phase 1 end-to-end ping.

Flow: mobile app -> FastAPI -> Supabase connectivity check -> typed response.
Returns 'ok' when Supabase is reachable, 'degraded' otherwise (the API itself
is still up). Gemini availability is reported but does not affect overall status
in Phase 1 since no AI call happens yet.
"""
from fastapi import APIRouter

from app.ai.gemini import is_available as gemini_available
from app.database.supabase import check_supabase
from app.utils.schemas import DependencyStatus, HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    supabase = check_supabase()

    available = gemini_available()
    gemini = DependencyStatus(
        name="gemini",
        status="ok" if available else "not_configured",
        detail="vertex ai" if available else "Vertex AI not configured (project/credentials)",
    )

    overall = "ok" if supabase.status == "ok" else "degraded"
    return HealthResponse(
        status=overall,
        dependencies=[supabase, gemini],
    )

"""POST /assistant — AI shopping assistant (natural language -> budget basket).

Thin route: delegates to services/recommender.py (candidates -> Gemini ->
validate -> optimizer -> budget), returns a typed AssistantResponse.
"""
from fastapi import APIRouter, HTTPException

from app.database.supabase import get_supabase
from app.services import recommender
from app.utils.schemas import AssistantRequest, AssistantResponse

router = APIRouter(tags=["assistant"])


@router.post("/assistant", response_model=AssistantResponse)
def assistant(req: AssistantRequest) -> AssistantResponse:
    if get_supabase() is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        result = recommender.recommend_basket(req.message, req.budget)
    except Exception as exc:  # noqa: BLE001 - surface Vertex/DB errors
        raise HTTPException(status_code=502, detail=f"Assistant failed: {exc}")
    return AssistantResponse(**result)

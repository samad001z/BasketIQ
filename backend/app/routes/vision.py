"""POST /scan — screenshot cart scanner (Phase 7).

Accepts an uploaded cart screenshot (multipart), stores it in the
`cart-screenshots` Storage bucket (best-effort, for audit), runs vision
extraction + matching + optimization via services/scanner.py.
"""
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.database.supabase import get_supabase
from app.services import scanner
from app.utils.schemas import ScanResponse

router = APIRouter(tags=["vision"])

_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


def _store_screenshot(data: bytes, mime: str) -> str | None:
    sb = get_supabase()
    if sb is None:
        return None
    path = f"scans/{uuid4()}.{_EXT.get(mime, 'png')}"
    try:
        sb.storage.from_("cart-screenshots").upload(
            path, data, {"content-type": mime}
        )
        return path
    except Exception:  # noqa: BLE001 - storage is best-effort; don't fail the scan
        return None


@router.post("/scan", response_model=ScanResponse)
async def scan(file: UploadFile = File(...)) -> ScanResponse:
    if get_supabase() is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    mime = file.content_type or "image/png"

    storage_path = _store_screenshot(data, mime)
    try:
        result = scanner.scan_cart_image(data, mime)
    except Exception as exc:  # noqa: BLE001 - surface Vertex/DB errors
        raise HTTPException(status_code=502, detail=f"Scan failed: {exc}")

    result["storage_path"] = storage_path
    return ScanResponse(**result)

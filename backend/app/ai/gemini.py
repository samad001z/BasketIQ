"""Gemini via Vertex AI (google-genai SDK).

Auth: a GCP service account (sa-vertex.json) via Application Default Credentials.
Uses Vertex AI (the user's Vertex credits) — NOT the AI Studio Developer API.

Models (locked for the whole project):
  - Chat / vision / reasoning : gemini-2.5-flash
  - Embeddings                : gemini-embedding-001  (output_dimensionality=768)
"""
from __future__ import annotations

import json
import math
import os
import re
import time
from functools import lru_cache
from typing import Any, Literal

from app.config import get_settings

CHAT_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768

# task_type values for embeddings (correctness matters for retrieval quality):
#   - embedding stored products  -> RETRIEVAL_DOCUMENT
#   - embedding a user's search  -> RETRIEVAL_QUERY
EmbedTaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]


@lru_cache
def get_client():
    """Return a cached google-genai Client configured for Vertex AI, or None if
    Vertex isn't configured. Lazy-imports google-genai so the backend boots
    without it installed (e.g. before Phase 3 deps).
    """
    settings = get_settings()
    if not settings.vertex_configured:
        return None

    os.environ.setdefault(
        "GOOGLE_APPLICATION_CREDENTIALS", settings.GOOGLE_APPLICATION_CREDENTIALS
    )
    from google import genai  # lazy import

    return genai.Client(
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )


def is_available() -> bool:
    return get_client() is not None


# --- Embeddings ------------------------------------------------------------

def _l2_normalize(vec: list[float]) -> list[float]:
    """Unit-normalize. gemini-embedding-001 is only normalized at its native
    3072 dims; at 768 dims we must normalize so cosine == dot product."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


def embed_texts(
    texts: list[str],
    task_type: EmbedTaskType,
    *,
    batch_size: int = 16,
    max_retries: int = 4,
) -> list[list[float]]:
    """Embed many strings to 768-d unit vectors.

    Rate-limit aware for the free/credit tier: batches requests and applies
    exponential backoff on transient errors. ~80 products is comfortable.
    """
    from google.genai import types  # lazy import

    client = get_client()
    if client is None:
        raise RuntimeError("Vertex AI not configured (project/credentials).")
    if not texts:
        return []

    config = types.EmbedContentConfig(
        task_type=task_type, output_dimensionality=EMBEDDING_DIM
    )

    out: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        chunk = texts[start : start + batch_size]
        last_err: Exception | None = None
        for attempt in range(max_retries):
            try:
                resp = client.models.embed_content(
                    model=EMBEDDING_MODEL, contents=chunk, config=config
                )
                out.extend(_l2_normalize(list(e.values)) for e in resp.embeddings)
                last_err = None
                break
            except Exception as exc:  # noqa: BLE001 - retry transient/rate-limit
                last_err = exc
                time.sleep(2**attempt)  # 1s, 2s, 4s, 8s
        if last_err is not None:
            raise last_err
        time.sleep(0.2)  # gentle pacing between batches
    return out


def embed_text(text: str, task_type: EmbedTaskType) -> list[float]:
    """Embed a single string to a 768-d unit vector."""
    return embed_texts([text], task_type)[0]


# --- Same-product judgement (matcher tie-break) ----------------------------

def same_product(a: str, b: str) -> bool:
    """Ask gemini-2.5-flash whether two product descriptions are the same SKU.
    Used only for borderline cosine matches. Fail-closed (False) on error."""
    client = get_client()
    if client is None:
        raise RuntimeError("Vertex AI not configured (project/credentials).")

    prompt = (
        "You compare grocery products. Are these two listings the SAME product "
        "(same item, brand and pack size — ignore platform/price)?\n"
        f"A: {a}\nB: {b}\n"
        "Answer with exactly one word: yes or no."
    )
    try:
        resp = client.models.generate_content(model=CHAT_MODEL, contents=prompt)
        return (resp.text or "").strip().lower().startswith("y")
    except Exception:  # noqa: BLE001
        return False


# --- Text + structured generation (gemini-2.5-flash) -----------------------

def chat(prompt: str, *, system: str | None = None) -> str:
    """Single-turn plain-text generation."""
    from google.genai import types

    client = get_client()
    if client is None:
        raise RuntimeError("Vertex AI not configured (project/credentials).")
    config = types.GenerateContentConfig(system_instruction=system) if system else None
    resp = client.models.generate_content(
        model=CHAT_MODEL, contents=prompt, config=config
    )
    return resp.text or ""


def _loads_lenient(text: str) -> Any:
    """Parse model JSON, tolerating ```json fences / stray prose."""
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        # last resort: grab the first {...} block
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


def generate_json(
    prompt: str,
    response_schema: Any | None = None,
    *,
    system: str | None = None,
    temperature: float = 0.2,
) -> Any:
    """Structured JSON generation. Uses response_mime_type=application/json plus
    an optional response schema (a pydantic model class), and parses defensively.
    """
    from google.genai import types

    client = get_client()
    if client is None:
        raise RuntimeError("Vertex AI not configured (project/credentials).")
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=response_schema,
        system_instruction=system,
        temperature=temperature,
    )
    resp = client.models.generate_content(
        model=CHAT_MODEL, contents=prompt, config=config
    )
    return _loads_lenient(resp.text or "")


def generate_json_from_image(
    prompt: str,
    image_bytes: bytes,
    mime_type: str,
    response_schema: Any | None = None,
    *,
    system: str | None = None,
    temperature: float = 0.0,
) -> Any:
    """Multimodal structured JSON generation (text prompt + one image)."""
    from google.genai import types

    client = get_client()
    if client is None:
        raise RuntimeError("Vertex AI not configured (project/credentials).")
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=response_schema,
        system_instruction=system,
        temperature=temperature,
    )
    resp = client.models.generate_content(
        model=CHAT_MODEL,
        contents=[prompt, types.Part.from_bytes(data=image_bytes, mime_type=mime_type)],
        config=config,
    )
    return _loads_lenient(resp.text or "")


def extract_cart_from_image(
    image_bytes: bytes,
    mime_type: str,
    *,
    prompt: str,
    response_schema: Any | None = None,
    system: str | None = None,
) -> Any:
    """Vision: extract structured cart items from a screenshot (Phase 7)."""
    return generate_json_from_image(
        prompt, image_bytes, mime_type, response_schema, system=system
    )

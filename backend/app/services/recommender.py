"""AI basket recommender — the wedge's brain.

Pipeline:
  1. Embed the user's request and pull a generous candidate slice from the
     catalog (pgvector nearest, Phase 3).
  2. Ask gemini-2.5-flash for a basket as STRUCTURED JSON, constrained to the
     candidate product_ids (it's told not to invent products).
  3. Validate every product_id against the candidate set; drop hallucinations,
     clamp quantities.
  4. Run the validated basket through the real optimizer for the true split.
  5. Budget mode: if a budget is set and exceeded, greedily trim the most
     expensive items (re-optimizing each time) and report what was removed.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.ai import gemini
from app.database.supabase import get_supabase
from app.services import matcher, optimizer

MAX_QTY = 10
CANDIDATE_K = 30

SYSTEM_PROMPT = (
    "You are BasketIQ's grocery shopping assistant for Indian quick-commerce. "
    "Given a shopper's request and a list of CANDIDATE products (with prices in "
    "INR), choose a sensible basket that satisfies the request. "
    "RULES: only use product_id values from the candidates — never invent "
    "products or ids. Respect any budget (keep the basket total at or under it). "
    "Prefer variety and good value. Return JSON only: an `items` array of "
    "{product_id, quantity} and a single-sentence `rationale`. If nothing fits, "
    "return an empty items array with a rationale explaining why."
)


# Structured-output schema handed to Gemini (NOT the public API model).
class _ProposedItem(BaseModel):
    product_id: str
    quantity: int


class _BasketProposal(BaseModel):
    items: list[_ProposedItem]
    rationale: str


def _cheapest_available(row: dict) -> float | None:
    prices = [
        pp["price"] for pp in row.get("platform_prices", []) if pp["availability"]
    ]
    return min(prices) if prices else None


def _shape_for_optimizer(row: dict, qty: int) -> dict:
    return {
        "product_id": row["id"],
        "name": row["name"],
        "brand": row.get("brand"),
        "quantity": qty,
        "prices": {
            pp["platform"]: {
                "price": pp["price"],
                "delivery_fee": pp["delivery_fee"],
                "free_delivery_threshold": pp["free_delivery_threshold"],
                "availability": pp["availability"],
            }
            for pp in row.get("platform_prices", [])
        },
    }


def _line_cost(row: dict, qty: int) -> float:
    cheapest = _cheapest_available(row)
    return (cheapest or 0.0) * qty


def recommend_basket(message: str, budget: float | None = None) -> dict:
    sb = get_supabase()
    if sb is None:
        raise RuntimeError("Supabase not configured.")

    # 1. Candidates via pgvector nearest (no similarity floor — we want a slice).
    near = matcher.candidates(message, k=CANDIDATE_K)
    ids = [n["id"] for n in near]
    rows = (
        sb.table("products")
        .select("*, platform_prices(*)")
        .in_("id", ids)
        .execute()
        .data
        or []
    )
    by_id = {r["id"]: r for r in rows}
    ordered = [by_id[i] for i in ids if i in by_id]

    # Compact context for the model.
    context = [
        {
            "product_id": r["id"],
            "name": r["name"],
            "brand": r.get("brand"),
            "quantity": r.get("quantity"),
            "category": r.get("category"),
            "price": _cheapest_available(r),
        }
        for r in ordered
        if _cheapest_available(r) is not None
    ]

    # 2. Ask Gemini for a structured basket.
    prompt = (
        f"Shopper request: {message}\n"
        f"Budget (INR): {budget if budget is not None else 'none'}\n"
        f"CANDIDATES (JSON): {context}"
    )
    proposal = gemini.generate_json(prompt, _BasketProposal, system=SYSTEM_PROMPT)

    rationale = (proposal.get("rationale") or "").strip() if isinstance(proposal, dict) else ""
    raw_items = proposal.get("items", []) if isinstance(proposal, dict) else []

    # 3. Validate: keep only known ids; clamp qty; merge duplicates.
    chosen: dict[str, int] = {}
    for it in raw_items:
        pid = it.get("product_id") if isinstance(it, dict) else None
        if pid not in by_id:
            continue
        qty = it.get("quantity", 1) if isinstance(it, dict) else 1
        try:
            qty = int(qty)
        except (TypeError, ValueError):
            qty = 1
        qty = max(1, min(MAX_QTY, qty))
        chosen[pid] = min(MAX_QTY, chosen.get(pid, 0) + qty)

    chosen_list = list(chosen.items())  # [(pid, qty)]

    # 4 + 5. Optimize, then trim to budget if needed.
    def optimize(items_pairs: list[tuple[str, int]]) -> dict:
        items = [_shape_for_optimizer(by_id[pid], qty) for pid, qty in items_pairs]
        return optimizer.optimize(items)

    result = optimize(chosen_list)
    trimmed: list[str] = []
    if budget is not None:
        while chosen_list and result["grand_total"] > budget:
            chosen_list.sort(
                key=lambda c: _line_cost(by_id[c[0]], c[1]), reverse=True
            )
            removed_pid, _ = chosen_list.pop(0)
            trimmed.append(by_id[removed_pid]["name"])
            result = optimize(chosen_list)

    within_budget = budget is None or result["grand_total"] <= budget

    note = None
    if trimmed:
        note = (
            f"Trimmed to fit ₹{budget:.0f}: removed {', '.join(trimmed)}."
            if budget is not None
            else None
        )
    elif not chosen_list:
        note = "No suitable items found for this request."

    basket = [
        {"product": by_id[pid], "quantity": qty} for pid, qty in chosen_list
    ]

    return {
        "message": message,
        "rationale": rationale,
        "budget": budget,
        "within_budget": within_budget,
        "note": note,
        "basket": basket,
        "optimization": result,
    }

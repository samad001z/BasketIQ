"""Cart optimizer — cheapest cross-platform split.

Algorithm (<=3 platforms ⇒ 7 non-empty subsets):
  For each subset S of {blinkit, zepto, instamart}:
    * assign every item to its cheapest AVAILABLE platform within S;
    * if any item has no available platform in S, skip the subset;
    * total = Σ(price × qty) + Σ(per-used-platform delivery fee, WAIVED when that
      platform's own subtotal ≥ its free_delivery_threshold).
  Keep the minimum-total subset.

Also computes the best single-platform total (cheapest platform that stocks every
item) and reports savings = single_best_total − optimized_total.

Items unavailable on ALL platforms can't be placed; they're returned separately
as `unavailable_items` and excluded from optimization (so a partial cart still
optimizes instead of failing).

`optimize()` is pure (no DB) for easy unit testing.
"""
from __future__ import annotations

from itertools import combinations

PLATFORMS = ("blinkit", "zepto", "instamart")

# Item shape consumed by optimize():
#   {
#     "product_id": str, "name": str, "brand": str | None,
#     "quantity": int,                         # cart quantity
#     "prices": { platform: {                  # only platforms present in catalog
#         "price": float, "delivery_fee": float,
#         "free_delivery_threshold": float | None, "availability": bool,
#     } }
#   }


def _round(x: float) -> float:
    return round(x + 1e-9, 2)


def _available_platforms(item: dict) -> list[str]:
    return [
        p
        for p in PLATFORMS
        if (row := item["prices"].get(p)) and row["availability"]
    ]


def _platform_delivery(fulfillable: list[dict]) -> dict[str, dict]:
    """Per-platform delivery params (fee/threshold). In our data these are
    constant per platform; take the first available row seen for each."""
    delivery: dict[str, dict] = {}
    for item in fulfillable:
        for p in PLATFORMS:
            row = item["prices"].get(p)
            if row and row["availability"] and p not in delivery:
                delivery[p] = {
                    "fee": float(row["delivery_fee"]),
                    "threshold": (
                        None
                        if row["free_delivery_threshold"] is None
                        else float(row["free_delivery_threshold"])
                    ),
                }
    return delivery


def _build_groups(
    fulfillable: list[dict], assignment: dict[str, str], delivery: dict[str, dict]
) -> tuple[float, list[dict]]:
    """Given item->platform assignment, build per-platform groups + grand total."""
    per: dict[str, dict] = {}
    for item in fulfillable:
        p = assignment[item["product_id"]]
        unit = float(item["prices"][p]["price"])
        line_total = unit * item["quantity"]
        bucket = per.setdefault(p, {"items": [], "subtotal": 0.0})
        bucket["items"].append(
            {
                "product_id": item["product_id"],
                "name": item["name"],
                "brand": item.get("brand"),
                "quantity": item["quantity"],
                "unit_price": _round(unit),
                "line_total": _round(line_total),
            }
        )
        bucket["subtotal"] += line_total

    total = 0.0
    groups: list[dict] = []
    for p in PLATFORMS:  # stable platform order
        if p not in per:
            continue
        subtotal = per[p]["subtotal"]
        fee = delivery[p]["fee"]
        threshold = delivery[p]["threshold"]
        waived = threshold is not None and subtotal >= threshold
        applied = 0.0 if waived else fee
        total += subtotal + applied
        groups.append(
            {
                "platform": p,
                "items": per[p]["items"],
                "subtotal": _round(subtotal),
                "delivery_fee": _round(fee),
                "delivery_applied": _round(applied),
                "delivery_waived": waived,
                "total": _round(subtotal + applied),
            }
        )
    return total, groups


def _single_platform_best(
    fulfillable: list[dict], delivery: dict[str, dict]
) -> tuple[str | None, float | None]:
    """Cheapest single platform that stocks every fulfillable item."""
    best_platform: str | None = None
    best_total: float | None = None
    for p in PLATFORMS:
        if all(
            (row := it["prices"].get(p)) and row["availability"] for it in fulfillable
        ):
            assignment = {it["product_id"]: p for it in fulfillable}
            total, _ = _build_groups(fulfillable, assignment, delivery)
            if best_total is None or total < best_total:
                best_platform, best_total = p, total
    return best_platform, (None if best_total is None else _round(best_total))


def optimize(items: list[dict]) -> dict:
    """Return the cheapest split. See module docstring for the shape."""
    fulfillable = [it for it in items if _available_platforms(it)]
    unavailable = [
        {"product_id": it["product_id"], "name": it["name"]}
        for it in items
        if not _available_platforms(it)
    ]

    if not fulfillable:
        return {
            "split": [],
            "grand_total": 0.0,
            "single_best_platform": None,
            "single_best_total": None,
            "savings": 0.0,
            "unavailable_items": unavailable,
            "item_count": 0,
        }

    delivery = _platform_delivery(fulfillable)

    best_total: float | None = None
    best_groups: list[dict] = []
    for size in (1, 2, 3):
        for subset in combinations(PLATFORMS, size):
            assignment: dict[str, str] = {}
            feasible = True
            for item in fulfillable:
                candidates = [
                    (float(item["prices"][p]["price"]), PLATFORMS.index(p), p)
                    for p in subset
                    if (row := item["prices"].get(p)) and row["availability"]
                ]
                if not candidates:
                    feasible = False
                    break
                # cheapest, tie-break by platform order for determinism
                assignment[item["product_id"]] = min(candidates)[2]
            if not feasible:
                continue
            total, groups = _build_groups(fulfillable, assignment, delivery)
            if best_total is None or total < best_total:
                best_total, best_groups = total, groups

    single_platform, single_total = _single_platform_best(fulfillable, delivery)
    savings = (
        _round(max(single_total - best_total, 0.0))
        if single_total is not None and best_total is not None
        else 0.0
    )

    return {
        "split": best_groups,
        "grand_total": _round(best_total or 0.0),
        "single_best_platform": single_platform,
        "single_best_total": single_total,
        "savings": savings,
        "unavailable_items": unavailable,
        "item_count": len(fulfillable),
    }

"""Unit tests for the cart optimizer (pure, no DB). Run: python -m tests.test_optimizer"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.optimizer import optimize  # noqa: E402


def item(pid, name, qty, prices):
    """prices: {platform: (price, fee, threshold, available)}"""
    return {
        "product_id": pid,
        "name": name,
        "brand": None,
        "quantity": qty,
        "prices": {
            p: {
                "price": pr,
                "delivery_fee": fee,
                "free_delivery_threshold": thr,
                "availability": av,
            }
            for p, (pr, fee, thr, av) in prices.items()
        },
    }


def test_split_beats_single():
    """X cheap on blinkit, Y cheap on zepto, no waiver -> splitting wins."""
    cart = [
        item("x", "X", 1, {"blinkit": (50, 25, 199, True), "zepto": (100, 20, 199, True)}),
        item("y", "Y", 1, {"blinkit": (100, 25, 199, True), "zepto": (50, 20, 199, True)}),
    ]
    r = optimize(cart)
    assert r["grand_total"] == 145.0, r["grand_total"]      # 50+25 + 50+20
    assert len(r["split"]) == 2
    assert r["single_best_platform"] == "zepto"
    assert r["single_best_total"] == 170.0                   # 100+50+20
    assert r["savings"] == 25.0
    print("test_split_beats_single OK ->", r["grand_total"], "save", r["savings"])


def test_single_with_waiver_wins():
    """Both cheapest on zepto and its subtotal waives delivery -> no pointless split."""
    cart = [
        item("a", "A", 1, {"blinkit": (100, 25, 150, True), "zepto": (90, 20, 150, True)}),
        item("b", "B", 1, {"blinkit": (100, 25, 150, True), "zepto": (95, 20, 150, True)}),
    ]
    r = optimize(cart)
    assert r["grand_total"] == 185.0, r["grand_total"]       # 90+95, delivery waived
    assert len(r["split"]) == 1
    assert r["split"][0]["delivery_waived"] is True
    assert r["savings"] == 0.0
    print("test_single_with_waiver_wins OK ->", r["grand_total"])


def test_quantity_and_unavailable():
    """Quantity multiplies; an item unavailable everywhere is excluded + reported."""
    cart = [
        item("x", "X", 3, {"blinkit": (30, 25, 199, True), "zepto": (30, 20, 199, False)}),
        item("z", "Z", 1, {"blinkit": (10, 25, 199, False), "zepto": (10, 20, 199, False)}),
    ]
    r = optimize(cart)
    assert r["item_count"] == 1
    assert len(r["unavailable_items"]) == 1 and r["unavailable_items"][0]["product_id"] == "z"
    assert r["grand_total"] == 115.0, r["grand_total"]       # 30*3 + 25 delivery
    assert r["split"][0]["items"][0]["line_total"] == 90.0
    print("test_quantity_and_unavailable OK ->", r["grand_total"])


if __name__ == "__main__":
    test_split_beats_single()
    test_single_with_waiver_wins()
    test_quantity_and_unavailable()
    print("\nALL OPTIMIZER UNIT TESTS PASSED")

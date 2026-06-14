/**
 * Client-side best-option computation, mirroring the backend's /search logic so
 * browse cards (/products) and detail can highlight the winner consistently.
 */
import type { Platform, PlatformPrice } from "@/lib/api";

export type BestOption = {
  cheapestPlatform: Platform;
  cheapestPrice: number;
  costliestPrice: number;
  savings: number; // cheapest vs most expensive available platform
  fastestPlatform: Platform;
  fastestMins: number | null;
  availableCount: number;
};

export function computeBestOption(prices: PlatformPrice[]): BestOption | null {
  const available = prices.filter((p) => p.availability);
  if (available.length === 0) return null;

  const cheapest = available.reduce((a, b) => (b.price < a.price ? b : a));
  const costliest = available.reduce((a, b) => (b.price > a.price ? b : a));
  const fastest = available.reduce((a, b) => {
    const am = a.delivery_time_mins ?? Number.POSITIVE_INFINITY;
    const bm = b.delivery_time_mins ?? Number.POSITIVE_INFINITY;
    return bm < am ? b : a;
  });

  return {
    cheapestPlatform: cheapest.platform,
    cheapestPrice: cheapest.price,
    costliestPrice: costliest.price,
    savings: Math.round((costliest.price - cheapest.price) * 100) / 100,
    fastestPlatform: fastest.platform,
    fastestMins: fastest.delivery_time_mins,
    availableCount: available.length,
  };
}

/** ₹ with no trailing .00 for whole rupees. */
export function formatINR(n: number): string {
  const v = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return `₹${v}`;
}

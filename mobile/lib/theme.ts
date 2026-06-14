/**
 * Design tokens shared by TS code (colors that must be dynamic, motion timings,
 * shadows). Static styling lives in NativeWind classes (tailwind.config.js);
 * this file holds the values components need at runtime.
 *
 * Direction: calm commerce — light, airy, ONE accent (green). Platform colors
 * are used only as small identifying dots, never as surfaces.
 */
import type { Platform } from "@/lib/api";

export const ACCENT = "#16A34A";
export const ACCENT_DARK = "#15803D";

export const PLATFORM_META: Record<
  Platform,
  { label: string; color: string }
> = {
  blinkit: { label: "Blinkit", color: "#F5C518" },
  zepto: { label: "Zepto", color: "#7C3AED" },
  instamart: { label: "Instamart", color: "#F97316" },
};

export const CATEGORY_EMOJI: Record<string, string> = {
  "Dairy & Eggs": "🥛",
  "Snacks & Chips": "🍿",
  Beverages: "🥤",
  "Coffee & Tea": "☕",
  Staples: "🌾",
  "Instant Food": "🍜",
  Bakery: "🍞",
  "Personal Care": "🧴",
  Household: "🧽",
};

export const categoryEmoji = (category: string | null): string =>
  (category && CATEGORY_EMOJI[category]) || "🛒";

/** Motion tokens — gentle, ease-out entrances; springy presses. */
export const MOTION = {
  enterMs: 280,
  staggerMs: 45,
  maxStaggerItems: 8,
  press: { damping: 18, stiffness: 260 },
};

/** Soft, single elevation for cards (cross-platform). */
export const cardShadow = {
  shadowColor: "#0B3D2E",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
} as const;

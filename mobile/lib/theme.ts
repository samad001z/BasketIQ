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

/** Soft tinted tile + Ionicon per category — premium fallback when a product
 * has no photo. Keeps green as the action color; tints add scannable life. */
export const CATEGORY_STYLE: Record<
  string,
  { tile: string; fg: string; ion: string }
> = {
  "Dairy & Eggs": { tile: "#FFF6E8", fg: "#E59410", ion: "egg-outline" },
  "Snacks & Chips": { tile: "#FFEFEF", fg: "#EF4444", ion: "fast-food-outline" },
  Beverages: { tile: "#EAF3FF", fg: "#2F7DEB", ion: "wine-outline" },
  "Coffee & Tea": { tile: "#F4EDE3", fg: "#B45309", ion: "cafe-outline" },
  Staples: { tile: "#EFF7E6", fg: "#5FA112", ion: "leaf-outline" },
  "Instant Food": { tile: "#FFF0E8", fg: "#F2762B", ion: "fast-food-outline" },
  Bakery: { tile: "#FBF1DF", fg: "#D08512", ion: "restaurant-outline" },
  "Personal Care": { tile: "#F2EEFF", fg: "#8B5CF6", ion: "sparkles-outline" },
  Household: { tile: "#E7F6F1", fg: "#0E9C84", ion: "home-outline" },
};

export const categoryStyle = (category: string | null) =>
  (category && CATEGORY_STYLE[category]) || {
    tile: "#EEF1EE",
    fg: "#8B948D",
    ion: "pricetag-outline",
  };

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

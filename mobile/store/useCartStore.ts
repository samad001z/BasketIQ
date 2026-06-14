import { create } from "zustand";

import type { Product } from "@/lib/api";

/**
 * Cart = client state (Zustand). No server persistence yet — user_cart + login
 * land in Phase 8 with auth. The optimizer takes cart contents as a payload.
 */
export type CartLine = { product: Product; quantity: number };

type CartState = {
  lines: CartLine[];
  add: (product: Product) => void; // add first unit (or +1 if present)
  inc: (id: string) => void;
  dec: (id: string) => void; // removes the line when it hits 0
  remove: (id: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  add: (product) =>
    set((s) => {
      const existing = s.lines.find((l) => l.product.id === product.id);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      return { lines: [...s.lines, { product, quantity: 1 }] };
    }),
  inc: (id) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.product.id === id ? { ...l, quantity: l.quantity + 1 } : l,
      ),
    })),
  dec: (id) =>
    set((s) => ({
      lines: s.lines
        .map((l) =>
          l.product.id === id ? { ...l, quantity: l.quantity - 1 } : l,
        )
        .filter((l) => l.quantity > 0),
    })),
  remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.product.id !== id) })),
  clear: () => set({ lines: [] }),
}));

/** Total unit count across the cart (for the header badge). */
export const useCartCount = () =>
  useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));

/** Quantity of one product currently in the cart. */
export const useCartQuantity = (id: string) =>
  useCartStore((s) => s.lines.find((l) => l.product.id === id)?.quantity ?? 0);

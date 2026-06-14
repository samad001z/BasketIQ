import { useEffect, useRef } from "react";

import type { Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useCartStore } from "@/store/useCartStore";

/**
 * Keeps the Zustand cart in sync with user_cart for signed-in users.
 *  - On login: load user_cart (joined with products) into the store.
 *  - On cart change (signed-in): debounced full replace of user_cart rows.
 *  - Guest carts stay purely local. RLS scopes every row to auth.uid().
 */
export function useCartSync() {
  const { session } = useAuth();
  const lines = useCartStore((s) => s.lines);
  const replace = useCartStore((s) => s.replace);
  const hydratedFor = useRef<string | null>(null);

  // Hydrate from user_cart on login.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !supabase) {
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === uid) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("user_cart")
        .select("quantity, product:products(*, platform_prices(*))")
        .eq("user_id", uid);
      if (!active) return;
      const loaded = (data ?? [])
        .filter((r: any) => r.product)
        .map((r: any) => ({ product: r.product as Product, quantity: r.quantity }));
      if (loaded.length > 0) replace(loaded); // else keep any local guest items
      hydratedFor.current = uid;
    })();
    return () => {
      active = false;
    };
  }, [session, replace]);

  // Persist on change (debounced) once hydrated.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !supabase || hydratedFor.current !== uid) return;
    const t = setTimeout(async () => {
      await supabase!.from("user_cart").delete().eq("user_id", uid);
      if (lines.length > 0) {
        await supabase!.from("user_cart").insert(
          lines.map((l) => ({
            user_id: uid,
            product_id: l.product.id,
            quantity: l.quantity,
          })),
        );
      }
    }, 800);
    return () => clearTimeout(t);
  }, [lines, session]);
}

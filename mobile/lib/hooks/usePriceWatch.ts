import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { Product } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PLATFORM_META } from "@/lib/theme";
import { useNotifications } from "@/store/useNotifications";

/**
 * Subscribe to platform_prices changes via Supabase Realtime. On a price drop,
 * surface an in-app toast and refresh cached catalog data so the UI is live.
 * (Requires the table in the supabase_realtime publication + REPLICA IDENTITY
 * FULL so old.price is delivered — both set in migration 0004.)
 */
export function usePriceWatch() {
  const push = useNotifications((s) => s.push);
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("price-watch")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "platform_prices" },
        (payload) => {
          const n = payload.new as any;
          const o = payload.old as any;
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["search"] });
          qc.invalidateQueries({ queryKey: ["history"] });

          if (n && o && typeof o.price === "number" && n.price < o.price) {
            const products = qc.getQueryData<Product[]>(["products"]);
            const name =
              products?.find((p) => p.id === n.product_id)?.name ?? "An item";
            const platform =
              PLATFORM_META[n.platform as keyof typeof PLATFORM_META]?.label ??
              n.platform;
            push({
              title: "Price drop 🎉",
              body: `${name} ₹${o.price} → ₹${n.price} on ${platform}`,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [push, qc]);
}

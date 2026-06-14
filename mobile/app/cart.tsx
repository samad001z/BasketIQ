import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartControl } from "@/components/CartControl";
import { OptimizedSplit } from "@/components/OptimizedSplit";
import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/lib/auth";
import { useOptimize } from "@/lib/hooks/useOptimize";
import { computeBestOption, formatINR } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { cardShadow, categoryEmoji } from "@/lib/theme";
import { useCartStore } from "@/store/useCartStore";
import { useNotifications } from "@/store/useNotifications";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const optimize = useOptimize();
  const { session } = useAuth();
  const pushToast = useNotifications((s) => s.push);

  const markBought = async () => {
    const result = optimize.data;
    if (!result) return;
    if (!session || !supabase) {
      router.push("/auth");
      return;
    }
    const items = result.split.flatMap((g) =>
      g.items.map((li) => ({
        product_id: li.product_id,
        name: li.name,
        quantity: li.quantity,
        platform: g.platform,
        price: li.unit_price,
      })),
    );
    const { error } = await supabase.from("saved_baskets").insert({
      user_id: session.user.id,
      items,
      total: result.grand_total,
      savings: result.savings,
    });
    pushToast(
      error
        ? { title: "Couldn’t save", body: error.message }
        : { title: "Saved to spending 📊", body: `${formatINR(result.grand_total)} recorded` },
    );
    if (!error) clear();
  };

  // Rough total = cheapest available price × qty (pre-optimization estimate).
  const roughTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const best = computeBestOption(l.product.platform_prices);
        return sum + (best ? best.cheapestPrice * l.quantity : 0);
      }, 0),
    [lines],
  );

  const runOptimize = () =>
    optimize.mutate(
      lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
    );

  const showingResult = optimize.isSuccess && optimize.data;

  return (
    <View className="flex-1 bg-surface-sunken">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center gap-3 px-5 pb-3"
      >
        <PressableScale onPress={() => router.back()}>
          <View
            style={cardShadow}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <Text className="text-[18px] text-ink">‹</Text>
          </View>
        </PressableScale>
        <Text className="flex-1 font-sans-semibold text-[16px] text-ink">
          {showingResult ? "Your smart split" : "My cart"}
        </Text>
        {lines.length > 0 && !showingResult && (
          <PressableScale onPress={clear}>
            <Text className="font-sans-medium text-[13px] text-ink-muted">Clear</Text>
          </PressableScale>
        )}
      </View>

      {lines.length === 0 ? (
        <View className="items-center px-10 pt-24">
          <Text className="text-4xl">🛒</Text>
          <Text className="mt-4 font-sans-semibold text-[16px] text-ink">
            Your cart is empty
          </Text>
          <Text className="mt-1.5 text-center font-sans text-[13px] text-ink-muted">
            Add items from search to compare and optimize.
          </Text>
          <PressableScale onPress={() => router.back()}>
            <Text className="mt-5 rounded-full bg-accent px-6 py-3 font-sans-semibold text-[14px] text-white">
              Browse products
            </Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 180,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
          >
            {showingResult ? (
              <OptimizedSplit result={optimize.data!} />
            ) : (
              lines.map((l) => {
                const best = computeBestOption(l.product.platform_prices);
                return (
                  <View
                    key={l.product.id}
                    style={cardShadow}
                    className="flex-row items-center gap-3 rounded-4xl bg-surface p-4"
                  >
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken">
                      <Text className="text-xl">
                        {categoryEmoji(l.product.category)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className="font-sans-semibold text-[14px] text-ink"
                      >
                        {l.product.name}
                      </Text>
                      <Text className="mt-0.5 font-sans text-[12px] text-ink-muted">
                        {best
                          ? `${formatINR(best.cheapestPrice)} × ${l.quantity}`
                          : "Unavailable"}
                      </Text>
                    </View>
                    <CartControl product={l.product} />
                  </View>
                );
              })
            )}

            {optimize.isError && (
              <Text className="px-1 font-sans text-[13px] text-red-600">
                Couldn’t optimize. Check the backend and try again.
              </Text>
            )}
          </ScrollView>

          {/* Sticky footer */}
          <View
            style={{ paddingBottom: insets.bottom + 16 }}
            className="absolute inset-x-0 bottom-0 border-t border-line bg-surface px-5 pt-4"
          >
            {showingResult ? (
              <View className="flex-row gap-3">
                <PressableScale onPress={() => optimize.reset()}>
                  <View className="items-center rounded-2xl bg-surface-sunken px-5 py-4">
                    <Text className="font-sans-semibold text-[15px] text-ink-soft">
                      Edit
                    </Text>
                  </View>
                </PressableScale>
                <View className="flex-1">
                  <PressableScale onPress={markBought}>
                    <View className="items-center rounded-2xl bg-accent py-4">
                      <Text className="font-sans-semibold text-[15px] text-white">
                        Mark as bought
                      </Text>
                    </View>
                  </PressableScale>
                </View>
              </View>
            ) : (
              <>
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-sans text-[13px] text-ink-muted">
                    Rough total (cheapest each)
                  </Text>
                  <Text className="font-display-bold text-[18px] text-ink">
                    {formatINR(Math.round(roughTotal * 100) / 100)}
                  </Text>
                </View>
                <PressableScale onPress={runOptimize} disabled={optimize.isPending}>
                  <View className="items-center rounded-2xl bg-accent py-4">
                    <Text className="font-sans-semibold text-[15px] text-white">
                      {optimize.isPending ? "Optimizing…" : "Optimize my cart"}
                    </Text>
                  </View>
                </PressableScale>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

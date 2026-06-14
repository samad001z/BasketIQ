import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartControl } from "@/components/CartControl";
import { PlatformCompareCard } from "@/components/PlatformCompareCard";
import { PlatformDot } from "@/components/PlatformDot";
import { PressableScale } from "@/components/PressableScale";
import type { Platform } from "@/lib/api";
import { useProduct } from "@/lib/hooks/useProducts";
import { computeBestOption, formatINR } from "@/lib/pricing";
import { categoryEmoji, cardShadow, PLATFORM_META } from "@/lib/theme";
import { useCartCount } from "@/store/useCartStore";

const PLATFORM_ORDER: Platform[] = ["blinkit", "zepto", "instamart"];

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const cartCount = useCartCount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading } = useProduct(id);

  const enter = (delay: number) =>
    reduced
      ? undefined
      : FadeInDown.duration(300).delay(delay).easing(Easing.out(Easing.cubic));

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
        <Text className="font-sans-semibold text-[16px] text-ink">
          Product details
        </Text>
      </View>

      {isLoading && !product ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#16A34A" />
        </View>
      ) : !product ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-4xl">🛒</Text>
          <Text className="mt-3 font-sans-semibold text-[16px] text-ink">
            Product not found
          </Text>
        </View>
      ) : (
        (() => {
          const best = computeBestOption(product.platform_prices);
          const byPlatform = new Map(
            product.platform_prices.map((p) => [p.platform, p]),
          );
          return (
            <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 120,
                gap: 16,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero */}
              <Animated.View entering={enter(0)}>
                <View className="items-center pt-2">
                  <View className="h-32 w-32 items-center justify-center rounded-4xl bg-surface">
                    <Text className="text-6xl">
                      {categoryEmoji(product.category)}
                    </Text>
                  </View>
                  <Text className="mt-4 text-center font-sans-bold text-[22px] text-ink">
                    {product.name}
                  </Text>
                  <Text className="mt-1 font-sans text-[13px] text-ink-muted">
                    {[product.brand, product.quantity].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Animated.View>

              {/* Best-price summary */}
              {best && (
                <Animated.View entering={enter(60)}>
                  <View
                    style={cardShadow}
                    className="rounded-4xl bg-accent p-5"
                  >
                    <Text className="font-sans-bold text-[11px] tracking-wide text-white/80">
                      ⭐ BEST OPTION
                    </Text>
                    <View className="mt-2 flex-row items-end justify-between">
                      <View>
                        <Text className="font-display-bold text-[34px] leading-none text-white">
                          {formatINR(best.cheapestPrice)}
                        </Text>
                        <Text className="mt-2 font-sans-medium text-[13px] text-white/90">
                          on {PLATFORM_META[best.cheapestPlatform].label}
                          {best.savings > 0
                            ? `  ·  save ${formatINR(best.savings)}`
                            : ""}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-sans-semibold text-[13px] text-white">
                          ⚡ {best.fastestMins ?? "—"} min
                        </Text>
                        <Text className="font-sans text-[11px] text-white/80">
                          fastest on {PLATFORM_META[best.fastestPlatform].label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Side-by-side comparison */}
              <Animated.View entering={enter(120)}>
                <Text className="mb-2.5 font-sans-semibold text-[14px] text-ink">
                  Compare all platforms
                </Text>
                <View className="flex-row gap-2.5">
                  {PLATFORM_ORDER.map((plat) => {
                    const price = byPlatform.get(plat);
                    if (!price) return null;
                    return (
                      <PlatformCompareCard
                        key={plat}
                        price={price}
                        isBest={best?.cheapestPlatform === plat}
                        isFastest={best?.fastestPlatform === plat}
                      />
                    );
                  })}
                </View>
              </Animated.View>

              {best == null && (
                <View className="flex-row items-center justify-center gap-2 pt-2">
                  <PlatformDot platform="blinkit" />
                  <Text className="font-sans-medium text-[13px] text-ink-muted">
                    Out of stock on all platforms
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Sticky add-to-cart bar */}
            <View
              style={{ paddingBottom: insets.bottom + 16 }}
              className="absolute inset-x-0 bottom-0 flex-row items-center gap-3 border-t border-line bg-surface px-5 pt-4"
            >
              <View className="flex-1">
                <CartControl product={product} size="lg" />
              </View>
              <PressableScale onPress={() => router.push("/cart")}>
                <View className="items-center justify-center rounded-2xl bg-accent-light px-5 py-4">
                  <Text className="font-sans-semibold text-[14px] text-accent-dark">
                    Cart{cartCount > 0 ? ` · ${cartCount}` : ""}
                  </Text>
                </View>
              </PressableScale>
            </View>
            </>
          );
        })()
      )}
    </View>
  );
}

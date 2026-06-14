import { router } from "expo-router";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { CartControl } from "@/components/CartControl";
import { PlatformDot } from "@/components/PlatformDot";
import { PressableScale } from "@/components/PressableScale";
import type { Product } from "@/lib/api";
import { computeBestOption, formatINR } from "@/lib/pricing";
import { categoryEmoji, cardShadow, MOTION, PLATFORM_META } from "@/lib/theme";

export function ResultCard({ product, index }: { product: Product; index: number }) {
  const reduced = useReducedMotion();
  const best = computeBestOption(product.platform_prices);

  const entering = reduced
    ? undefined
    : FadeInDown.duration(MOTION.enterMs)
        .delay(Math.min(index, MOTION.maxStaggerItems) * MOTION.staggerMs)
        .easing(Easing.out(Easing.cubic));

  return (
    <Animated.View entering={entering}>
      <PressableScale
        onPress={() =>
          router.push({ pathname: "/product/[id]", params: { id: product.id } })
        }
      >
        <View style={cardShadow} className="rounded-4xl bg-surface p-4">
          {/* Row 1: glyph · name/meta · price + fastest */}
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-surface-sunken">
              <Text className="text-2xl">{categoryEmoji(product.category)}</Text>
            </View>

            <View className="flex-1">
              <Text
                numberOfLines={1}
                className="font-sans-semibold text-[15px] text-ink"
              >
                {product.name}
              </Text>
              <Text className="mt-0.5 font-sans text-[12px] text-ink-muted">
                {[product.brand, product.quantity].filter(Boolean).join(" · ")}
              </Text>
            </View>

            {best ? (
              <View className="items-end">
                <Text className="font-display-bold text-[22px] leading-none text-ink">
                  {formatINR(best.cheapestPrice)}
                </Text>
                <View className="mt-1 flex-row items-center gap-1.5">
                  <PlatformDot platform={best.cheapestPlatform} />
                  <Text className="font-sans-medium text-[11px] text-ink-soft">
                    {PLATFORM_META[best.cheapestPlatform].label} · ⚡
                    {best.fastestMins ?? "—"}m
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="font-sans-medium text-[12px] text-ink-muted">
                Unavailable
              </Text>
            )}
          </View>

          {/* Row 2: BEST · savings · add-to-cart */}
          {best && (
            <View className="mt-3.5 flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 rounded-full bg-accent-light px-2.5 py-1">
                <Text className="text-[10px]">⭐</Text>
                <Text className="font-sans-bold text-[10px] tracking-wide text-accent-dark">
                  BEST
                </Text>
              </View>

              {best.savings > 0 && (
                <View className="rounded-full bg-accent-light px-2.5 py-1">
                  <Text className="font-sans-semibold text-[11px] text-accent-dark">
                    Save {formatINR(best.savings)}
                  </Text>
                </View>
              )}

              <View className="flex-1" />

              <CartControl product={product} />
            </View>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { CartControl } from "@/components/CartControl";
import { PressableScale } from "@/components/PressableScale";
import { ProductThumb } from "@/components/ProductThumb";
import type { Product } from "@/lib/api";
import { computeBestOption, formatINR } from "@/lib/pricing";
import { cardShadow, MOTION, PLATFORM_META } from "@/lib/theme";

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
        <View style={cardShadow} className="rounded-3xl bg-surface p-3.5">
          <View className="flex-row gap-3.5">
            <ProductThumb product={product} size={72} radius={18} />

            <View className="flex-1 justify-center">
              <Text
                numberOfLines={1}
                className="font-sans-bold text-[15px] text-ink"
              >
                {product.name}
              </Text>
              <Text className="mt-0.5 font-sans text-[12px] text-ink-muted">
                {[product.brand, product.quantity].filter(Boolean).join(" · ")}
              </Text>

              {best ? (
                <View className="mt-2 flex-row items-center gap-1.5">
                  <View className="flex-row items-center gap-1 rounded-md bg-accent px-1.5 py-0.5">
                    <Ionicons name="star" size={9} color="#fff" />
                    <Text className="font-sans-bold text-[9px] tracking-wide text-white">
                      BEST
                    </Text>
                  </View>
                  <Text className="font-sans-medium text-[11px] text-ink-soft">
                    {PLATFORM_META[best.cheapestPlatform].label}
                  </Text>
                  <Ionicons name="flash" size={11} color="#8B948D" />
                  <Text className="font-sans-medium text-[11px] text-ink-muted">
                    {best.fastestMins ?? "—"}m
                  </Text>
                </View>
              ) : (
                <Text className="mt-2 font-sans-medium text-[12px] text-ink-muted">
                  Out of stock
                </Text>
              )}
            </View>

            {best && (
              <View className="items-end justify-center">
                <Text className="font-display-bold text-[22px] leading-none text-ink">
                  {formatINR(best.cheapestPrice)}
                </Text>
                {best.savings > 0 && (
                  <View className="mt-1.5 rounded-md bg-accent-light px-1.5 py-0.5">
                    <Text className="font-sans-semibold text-[10px] text-accent-dark">
                      save {formatINR(best.savings)}
                    </Text>
                  </View>
                )}
                <View className="mt-2">
                  <CartControl product={product} />
                </View>
              </View>
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

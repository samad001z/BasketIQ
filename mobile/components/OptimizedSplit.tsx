import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { PlatformDot } from "@/components/PlatformDot";
import type { OptimizeResponse } from "@/lib/api";
import { formatINR } from "@/lib/pricing";
import { cardShadow, PLATFORM_META } from "@/lib/theme";

export function OptimizedSplit({ result }: { result: OptimizeResponse }) {
  const reduced = useReducedMotion();
  const enter = (i: number) =>
    reduced
      ? undefined
      : FadeInDown.duration(300)
          .delay(i * 80)
          .easing(Easing.out(Easing.cubic));

  return (
    <View className="gap-4">
      {/* Savings banner */}
      <Animated.View entering={enter(0)}>
        <View style={cardShadow} className="rounded-4xl bg-accent p-5">
          <Text className="font-sans-medium text-[12px] text-white/85">
            Smartest split across {result.split.length} platform
            {result.split.length > 1 ? "s" : ""}
          </Text>
          {result.savings > 0 ? (
            <>
              <Text className="mt-1 font-display-bold text-[30px] leading-none text-white">
                You save {formatINR(result.savings)}
              </Text>
              {result.single_best_total != null && (
                <Text className="mt-2 font-sans text-[12px] text-white/80">
                  {formatINR(result.grand_total)} split · vs{" "}
                  {formatINR(result.single_best_total)} on{" "}
                  {result.single_best_platform
                    ? PLATFORM_META[result.single_best_platform].label
                    : "one app"}{" "}
                  alone
                </Text>
              )}
            </>
          ) : (
            <Text className="mt-1 font-display-bold text-[24px] leading-tight text-white">
              {formatINR(result.grand_total)} — already best as one order
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Per-platform groups */}
      {result.split.map((g, i) => (
        <Animated.View key={g.platform} entering={enter(i + 1)}>
          <View style={cardShadow} className="rounded-4xl bg-surface p-4">
            <View className="flex-row items-center gap-2">
              <PlatformDot platform={g.platform} />
              <Text className="flex-1 font-sans-semibold text-[15px] text-ink">
                {PLATFORM_META[g.platform].label}
              </Text>
              <Text className="font-display-bold text-[18px] text-ink">
                {formatINR(g.total)}
              </Text>
            </View>

            <View className="my-3 h-px bg-line" />

            <View className="gap-2">
              {g.items.map((li) => (
                <View key={li.product_id} className="flex-row items-center">
                  <Text
                    numberOfLines={1}
                    className="flex-1 font-sans text-[13px] text-ink-soft"
                  >
                    {li.name}
                    {li.quantity > 1 ? `  ×${li.quantity}` : ""}
                  </Text>
                  <Text className="font-sans-medium text-[13px] text-ink">
                    {formatINR(li.line_total)}
                  </Text>
                </View>
              ))}
            </View>

            <View className="mt-3 flex-row items-center justify-between">
              <Text className="font-sans text-[12px] text-ink-muted">
                Subtotal {formatINR(g.subtotal)}
              </Text>
              <Text
                className={`font-sans-medium text-[12px] ${
                  g.delivery_waived ? "text-accent-dark" : "text-ink-soft"
                }`}
              >
                {g.delivery_waived
                  ? "Free delivery"
                  : `+ ${formatINR(g.delivery_applied)} delivery`}
              </Text>
            </View>
          </View>
        </Animated.View>
      ))}

      {/* Grand total */}
      <Animated.View entering={enter(result.split.length + 1)}>
        <View className="flex-row items-center justify-between px-1 pt-1">
          <Text className="font-sans-semibold text-[16px] text-ink">Grand total</Text>
          <Text className="font-display-bold text-[22px] text-ink">
            {formatINR(result.grand_total)}
          </Text>
        </View>
      </Animated.View>

      {result.unavailable_items.length > 0 && (
        <View className="rounded-2xl bg-surface px-4 py-3">
          <Text className="font-sans-medium text-[12px] text-ink-muted">
            Out of stock everywhere:{" "}
            {result.unavailable_items.map((u) => u.name).join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
}

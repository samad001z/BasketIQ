import { Text, View } from "react-native";

import { PlatformDot } from "@/components/PlatformDot";
import type { PlatformPrice } from "@/lib/api";
import { formatINR } from "@/lib/pricing";
import { PLATFORM_META } from "@/lib/theme";

type Props = {
  price: PlatformPrice;
  isBest: boolean;
  isFastest: boolean;
};

/** One platform column in the side-by-side detail comparison. */
export function PlatformCompareCard({ price, isBest, isFastest }: Props) {
  const out = !price.availability;
  const freeOver = price.free_delivery_threshold;

  return (
    <View
      className={`flex-1 rounded-3xl border p-3 ${
        isBest ? "border-accent bg-accent-light" : "border-line bg-surface"
      } ${out ? "opacity-50" : ""}`}
    >
      {/* Header: brand + BEST tag */}
      <View className="flex-row items-center gap-1.5">
        <PlatformDot platform={price.platform} size={8} />
        <Text
          numberOfLines={1}
          className="flex-1 font-sans-semibold text-[12px] text-ink"
        >
          {PLATFORM_META[price.platform].label}
        </Text>
      </View>

      {isBest && (
        <Text className="mt-1 font-sans-bold text-[9px] tracking-wide text-accent-dark">
          ⭐ BEST PRICE
        </Text>
      )}

      {/* Price */}
      <Text className="mt-2 font-display-bold text-[20px] leading-none text-ink">
        {out ? "—" : formatINR(price.price)}
      </Text>

      {/* Meta rows */}
      <View className="mt-3 gap-1.5">
        <Text className="font-sans text-[11px] text-ink-soft">
          {price.delivery_fee > 0
            ? `Delivery ${formatINR(price.delivery_fee)}`
            : "Free delivery"}
        </Text>
        {freeOver != null && price.delivery_fee > 0 && (
          <Text className="font-sans text-[10px] text-ink-muted">
            Free over {formatINR(freeOver)}
          </Text>
        )}
        <Text
          className={`font-sans-medium text-[11px] ${
            isFastest ? "text-accent-dark" : "text-ink-soft"
          }`}
        >
          {isFastest ? "⚡ " : ""}
          {price.delivery_time_mins ?? "—"} min
        </Text>
        <Text
          className={`font-sans-medium text-[11px] ${
            out ? "text-ink-muted" : "text-accent-dark"
          }`}
        >
          {out ? "Out of stock" : "In stock"}
        </Text>
      </View>
    </View>
  );
}

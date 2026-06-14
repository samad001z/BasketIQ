import { Dimensions, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { PlatformDot } from "@/components/PlatformDot";
import type { Platform, PlatformHistory } from "@/lib/api";
import { PLATFORM_META } from "@/lib/theme";

const ORDER: Platform[] = ["blinkit", "zepto", "instamart"];

/** Multi-line price-over-time chart (one line per platform). */
export function PriceHistoryChart({ history }: { history: PlatformHistory[] }) {
  const width = Dimensions.get("window").width - 80;
  const series = (p: Platform) =>
    (history.find((h) => h.platform === p)?.points ?? []).map((pt) => ({
      value: pt.price,
    }));

  const all = history.flatMap((h) => h.points.map((p) => p.price));
  const maxValue = all.length ? Math.ceil(Math.max(...all) * 1.1) : 100;
  const longest = Math.max(1, ...history.map((h) => h.points.length));
  const spacing = width / Math.max(longest, 2);

  return (
    <View>
      <LineChart
        data={series("blinkit")}
        data2={series("zepto")}
        data3={series("instamart")}
        color1={PLATFORM_META.blinkit.color}
        color2={PLATFORM_META.zepto.color}
        color3={PLATFORM_META.instamart.color}
        thickness={2.5}
        curved
        hideDataPoints
        hideRules
        maxValue={maxValue}
        noOfSections={4}
        width={width}
        spacing={spacing}
        initialSpacing={8}
        yAxisColor="transparent"
        xAxisColor="#EAEEEB"
        yAxisTextStyle={{ color: "#8B948D", fontSize: 10 }}
      />
      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
        {ORDER.map((p) => (
          <View key={p} className="flex-row items-center gap-1.5">
            <PlatformDot platform={p} />
            <Text className="font-sans-medium text-[11px] text-ink-soft">
              {PLATFORM_META[p].label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

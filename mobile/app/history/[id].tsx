import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlatformDot } from "@/components/PlatformDot";
import { PressableScale } from "@/components/PressableScale";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useProductHistory } from "@/lib/hooks/useProductHistory";
import { formatINR } from "@/lib/pricing";
import { cardShadow, PLATFORM_META } from "@/lib/theme";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useProductHistory(id);

  const hasPoints = (data?.history ?? []).some((h) => h.points.length > 0);

  return (
    <View className="flex-1 bg-surface-sunken">
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
        <Text className="font-sans-semibold text-[16px] text-ink">Price history</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#16A34A" />
        </View>
      ) : isError || !data ? (
        <View className="items-center px-10 pt-20">
          <Text className="font-sans text-[13px] text-ink-muted">
            Couldn’t load price history.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
            gap: 16,
          }}
        >
          <Text className="font-sans-bold text-[20px] text-ink">{data.name}</Text>

          <View style={cardShadow} className="rounded-4xl bg-surface p-4">
            {hasPoints ? (
              <PriceHistoryChart history={data.history} />
            ) : (
              <Text className="py-8 text-center font-sans text-[13px] text-ink-muted">
                No history yet — prices will chart here as they change.
              </Text>
            )}
          </View>

          <View style={cardShadow} className="rounded-4xl bg-surface p-4">
            <Text className="mb-2 font-sans-semibold text-[14px] text-ink">
              Current price
            </Text>
            {data.history.map((h) => (
              <View
                key={h.platform}
                className="flex-row items-center justify-between py-2"
              >
                <View className="flex-row items-center gap-2">
                  <PlatformDot platform={h.platform} />
                  <Text className="font-sans-medium text-[13px] text-ink-soft">
                    {PLATFORM_META[h.platform].label}
                  </Text>
                </View>
                <Text className="font-display-bold text-[15px] text-ink">
                  {h.current != null ? formatINR(h.current) : "—"}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

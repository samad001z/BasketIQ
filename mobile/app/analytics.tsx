import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { cardShadow } from "@/lib/theme";

type Row = { total: number; savings: number; bought_at: string };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("saved_baskets")
        .select("total,savings,bought_at")
        .order("bought_at", { ascending: true });
      if (active) {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const { months, totalSpend, totalSaved, thisSpend, thisSaved } = useMemo(() => {
    const map = new Map<string, { spend: number; saved: number }>();
    for (const r of rows) {
      const d = new Date(r.bought_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const cur = map.get(key) ?? { spend: 0, saved: 0 };
      cur.spend += Number(r.total);
      cur.saved += Number(r.savings);
      map.set(key, cur);
    }
    const entries = [...map.entries()].sort();
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${now.getMonth()}`;
    const here = map.get(thisKey) ?? { spend: 0, saved: 0 };
    return {
      months: entries.map(([k, v]) => ({
        value: Math.round(v.spend),
        label: MONTHS[Number(k.split("-")[1])],
      })),
      totalSpend: rows.reduce((n, r) => n + Number(r.total), 0),
      totalSaved: rows.reduce((n, r) => n + Number(r.savings), 0),
      thisSpend: here.spend,
      thisSaved: here.saved,
    };
  }, [rows]);

  const header = (
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
      <Text className="font-sans-semibold text-[16px] text-ink">Spending</Text>
    </View>
  );

  if (!session) {
    return (
      <View className="flex-1 bg-surface-sunken">
        {header}
        <View className="items-center px-10 pt-20">
          <Text className="text-4xl">📊</Text>
          <Text className="mt-4 text-center font-sans-semibold text-[15px] text-ink">
            Sign in to see your spending
          </Text>
          <PressableScale onPress={() => router.replace("/auth")}>
            <Text className="mt-5 rounded-full bg-accent px-6 py-3 font-sans-semibold text-[14px] text-white">
              Sign in
            </Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-sunken">
      {header}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#16A34A" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
            gap: 14,
          }}
        >
          <View className="flex-row gap-3">
            <View style={cardShadow} className="flex-1 rounded-4xl bg-surface p-4">
              <Text className="font-sans text-[12px] text-ink-muted">This month</Text>
              <Text className="mt-1 font-display-bold text-[22px] text-ink">
                {formatINR(Math.round(thisSpend))}
              </Text>
              <Text className="font-sans text-[11px] text-ink-muted">spent</Text>
            </View>
            <View style={cardShadow} className="flex-1 rounded-4xl bg-accent p-4">
              <Text className="font-sans text-[12px] text-white/85">Saved via BasketIQ</Text>
              <Text className="mt-1 font-display-bold text-[22px] text-white">
                {formatINR(Math.round(thisSaved))}
              </Text>
              <Text className="font-sans text-[11px] text-white/80">this month</Text>
            </View>
          </View>

          <View style={cardShadow} className="rounded-4xl bg-surface p-4">
            <Text className="mb-3 font-sans-semibold text-[14px] text-ink">
              Monthly spend
            </Text>
            {months.length > 0 ? (
              <LineChart
                data={months}
                color1="#16A34A"
                thickness={2.5}
                curved
                hideRules
                areaChart
                startFillColor="#16A34A"
                startOpacity={0.18}
                endOpacity={0.01}
                noOfSections={4}
                width={Dimensions.get("window").width - 90}
                yAxisColor="transparent"
                xAxisColor="#EAEEEB"
                yAxisTextStyle={{ color: "#8B948D", fontSize: 10 }}
                xAxisLabelTextStyle={{ color: "#8B948D", fontSize: 10 }}
              />
            ) : (
              <Text className="py-6 text-center font-sans text-[13px] text-ink-muted">
                No purchases yet. Tap “Mark as bought” after optimizing a cart.
              </Text>
            )}
          </View>

          <View style={cardShadow} className="rounded-4xl bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[13px] text-ink-soft">Total spent</Text>
              <Text className="font-sans-semibold text-[14px] text-ink">
                {formatINR(Math.round(totalSpend))}
              </Text>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="font-sans text-[13px] text-ink-soft">Total saved</Text>
              <Text className="font-sans-semibold text-[14px] text-accent-dark">
                {formatINR(Math.round(totalSaved))}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

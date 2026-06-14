import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OptimizedSplit } from "@/components/OptimizedSplit";
import { PressableScale } from "@/components/PressableScale";
import { ProductThumb } from "@/components/ProductThumb";
import { useScan } from "@/lib/hooks/useScan";
import { formatINR } from "@/lib/pricing";
import { cardShadow } from "@/lib/theme";
import { useCartStore } from "@/store/useCartStore";

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<string | null>(null);
  const scan = useScan();
  const addQuantity = useCartStore((s) => s.addQuantity);
  const result = scan.data;

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setPreview(a.uri);
    scan.mutate({
      uri: a.uri,
      name: a.fileName ?? "cart.jpg",
      type: a.mimeType ?? "image/jpeg",
    });
  };

  const addAll = () => {
    result?.basket.forEach((b) => addQuantity(b.product, b.quantity));
    router.push("/cart");
  };

  const saved = result?.savings_vs_screenshot ?? 0;

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
          Scan a cart 📷
        </Text>
      </View>

      {scan.isPending ? (
        <View className="flex-1 items-center justify-center">
          {preview && (
            <Image
              source={preview}
              style={{ width: 120, height: 120, borderRadius: 20, marginBottom: 16 }}
              contentFit="cover"
            />
          )}
          <ActivityIndicator color="#16A34A" />
          <Text className="mt-3 font-sans text-[13px] text-ink-muted">
            Reading your screenshot…
          </Text>
        </View>
      ) : !result ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl">🧾</Text>
          <Text className="mt-4 text-center font-sans-semibold text-[16px] text-ink">
            Compare any cart in one tap
          </Text>
          <Text className="mt-1.5 text-center font-sans text-[13px] text-ink-muted">
            Upload a screenshot of your Blinkit, Zepto or Instamart cart and I'll
            find the same items cheaper.
          </Text>
          {scan.isError && (
            <Text className="mt-4 text-center font-sans text-[13px] text-red-600">
              Couldn’t read that screenshot. Try another.
            </Text>
          )}
          <PressableScale onPress={pick}>
            <View className="mt-6 rounded-2xl bg-accent px-7 py-4">
              <Text className="font-sans-semibold text-[15px] text-white">
                Pick a cart screenshot
              </Text>
            </View>
          </PressableScale>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: result.basket.length > 0 ? 180 : 40,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Savings banner */}
            <View style={cardShadow} className="rounded-4xl bg-accent p-5">
              {saved > 0 ? (
                <>
                  <Text className="font-sans-medium text-[12px] text-white/85">
                    Same cart, optimized
                  </Text>
                  <Text className="mt-1 font-display-bold text-[30px] leading-none text-white">
                    You’d save {formatINR(saved)}
                  </Text>
                  {result.screenshot_total != null && (
                    <Text className="mt-2 font-sans text-[12px] text-white/80">
                      {formatINR(result.screenshot_total)} on the screenshot →{" "}
                      {formatINR(result.optimization.grand_total)} optimized
                    </Text>
                  )}
                </>
              ) : (
                <Text className="font-sans-semibold text-[16px] text-white">
                  Matched {result.matched_count} item
                  {result.matched_count === 1 ? "" : "s"} ·{" "}
                  {formatINR(result.optimization.grand_total)}
                </Text>
              )}
            </View>

            {/* Extracted items */}
            <View style={cardShadow} className="rounded-4xl bg-surface p-4">
              <Text className="mb-1 font-sans-semibold text-[14px] text-ink">
                From your screenshot ({result.extracted.length})
              </Text>
              {result.extracted.map((e, i) => (
                <View key={`${e.name}-${i}`} className="flex-row items-center gap-3 py-2.5">
                  <ProductThumb product={e.matched_product} size={40} />
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="font-sans-medium text-[13px] text-ink"
                    >
                      {e.matched_product ? e.matched_product.name : e.name}
                    </Text>
                    <Text className="font-sans text-[11px] text-ink-muted">
                      {e.matched
                        ? `seen ${e.price_seen != null ? formatINR(e.price_seen) : "—"}`
                        : "Not recognized"}
                    </Text>
                  </View>
                  {!e.matched && (
                    <View className="rounded-full bg-surface-sunken px-2.5 py-1">
                      <Text className="font-sans-medium text-[10px] text-ink-muted">
                        SKIPPED
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              {result.unmatched_count > 0 && (
                <Text className="mt-1 font-sans text-[11px] text-ink-muted">
                  {result.unmatched_count} item
                  {result.unmatched_count === 1 ? "" : "s"} couldn’t be matched to
                  the catalog.
                </Text>
              )}
            </View>

            {/* Optimized split */}
            {result.basket.length > 0 && (
              <OptimizedSplit result={result.optimization} />
            )}
          </ScrollView>

          {result.basket.length > 0 && (
            <View
              style={{ paddingBottom: insets.bottom + 16 }}
              className="absolute inset-x-0 bottom-0 border-t border-line bg-surface px-5 pt-4"
            >
              <PressableScale onPress={addAll}>
                <View className="items-center rounded-2xl bg-accent py-4">
                  <Text className="font-sans-semibold text-[15px] text-white">
                    Add all to cart · {formatINR(result.optimization.grand_total)}
                  </Text>
                </View>
              </PressableScale>
            </View>
          )}
        </>
      )}
    </View>
  );
}

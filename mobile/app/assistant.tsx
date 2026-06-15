import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OptimizedSplit } from "@/components/OptimizedSplit";
import { PressableScale } from "@/components/PressableScale";
import { ProductThumb } from "@/components/ProductThumb";
import { useAssistant } from "@/lib/hooks/useAssistant";
import { formatINR } from "@/lib/pricing";
import { cardShadow } from "@/lib/theme";
import { useCartStore } from "@/store/useCartStore";

const SUGGESTIONS = [
  "Snacks under ₹300",
  "Coffee & milk for the week",
  "Breakfast basket under ₹250",
];

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const assistant = useAssistant();
  const addQuantity = useCartStore((s) => s.addQuantity);

  const result = assistant.data;

  const ask = (text?: string) => {
    const msg = (text ?? message).trim();
    if (!msg) return;
    if (text) setMessage(text);
    const b = budget.trim() ? Number(budget.trim()) : undefined;
    assistant.mutate({ message: msg, budget: Number.isFinite(b) ? b : undefined });
  };

  const addAll = () => {
    result?.basket.forEach((b) => addQuantity(b.product, b.quantity));
    router.push("/cart");
  };

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
          AI Assistant ✨
        </Text>
      </View>

      {/* Input */}
      <View className="px-5">
        <View style={cardShadow} className="rounded-3xl bg-surface p-2">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="What do you need? e.g. snacks under ₹300"
            placeholderTextColor="#8B948D"
            className="px-3 py-2 font-sans text-[15px] text-ink"
            multiline
          />
          <View className="flex-row items-center gap-2">
            <View className="ml-1 flex-row items-center rounded-full bg-surface-sunken px-3">
              <Text className="font-sans-medium text-[14px] text-ink-soft">₹</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                placeholder="budget"
                placeholderTextColor="#8B948D"
                keyboardType="number-pad"
                className="w-20 py-2 font-sans text-[14px] text-ink"
              />
            </View>
            <View className="flex-1" />
            <PressableScale onPress={() => ask()}>
              <View className="rounded-full bg-accent px-6 py-2.5">
                <Text className="font-sans-semibold text-[14px] text-white">Ask</Text>
              </View>
            </PressableScale>
          </View>
        </View>

        {/* Suggestions */}
        {!result && !assistant.isPending && (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <PressableScale key={s} onPress={() => ask(s)}>
                <Text className="rounded-full bg-surface px-3.5 py-2 font-sans-medium text-[12px] text-ink-soft">
                  {s}
                </Text>
              </PressableScale>
            ))}
          </View>
        )}
      </View>

      {/* Body */}
      {assistant.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#16A34A" />
          <Text className="mt-3 font-sans text-[13px] text-ink-muted">
            Building your basket…
          </Text>
        </View>
      ) : assistant.isError ? (
        <View className="items-center px-10 pt-16">
          <Text className="text-4xl">⚠️</Text>
          <Text className="mt-3 text-center font-sans text-[13px] text-ink-muted">
            Couldn’t reach the assistant. Check the backend and try again.
          </Text>
        </View>
      ) : result ? (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 180,
              gap: 14,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Rationale */}
            <View style={cardShadow} className="rounded-4xl bg-surface p-4">
              <Text className="font-sans text-[14px] leading-5 text-ink-soft">
                {result.rationale || "Here's a basket for you."}
              </Text>
              {result.note && (
                <Text className="mt-2 font-sans-medium text-[12px] text-accent-dark">
                  {result.note}
                </Text>
              )}
            </View>

            {/* Basket items */}
            {result.basket.length > 0 ? (
              <View style={cardShadow} className="rounded-4xl bg-surface p-4">
                <Text className="mb-2 font-sans-semibold text-[14px] text-ink">
                  Suggested basket ({result.basket.length})
                </Text>
                {result.basket.map((b) => (
                  <View
                    key={b.product.id}
                    className="flex-row items-center gap-3 py-2"
                  >
                    <ProductThumb product={b.product} size={38} radius={11} />
                    <Text
                      numberOfLines={1}
                      className="flex-1 font-sans text-[13px] text-ink-soft"
                    >
                      {b.product.name}
                      {b.quantity > 1 ? `  ×${b.quantity}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center py-6">
                <Text className="font-sans text-[13px] text-ink-muted">
                  No items matched — try a different request.
                </Text>
              </View>
            )}

            {/* Optimized split */}
            {result.basket.length > 0 && (
              <OptimizedSplit result={result.optimization} />
            )}
          </ScrollView>

          {/* Add all */}
          {result.basket.length > 0 && (
            <View
              style={{ paddingBottom: insets.bottom + 16 }}
              className="absolute inset-x-0 bottom-0 border-t border-line bg-surface px-5 pt-4"
            >
              <PressableScale onPress={addAll}>
                <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-accent py-4">
                  <Text className="font-sans-semibold text-[15px] text-white">
                    Add all to cart · {formatINR(result.optimization.grand_total)}
                  </Text>
                </View>
              </PressableScale>
            </View>
          )}
        </>
      ) : (
        <View className="items-center px-10 pt-20">
          <Text className="text-4xl">🧺</Text>
          <Text className="mt-4 text-center font-sans-semibold text-[15px] text-ink">
            Tell me what you need and a budget
          </Text>
          <Text className="mt-1.5 text-center font-sans text-[13px] text-ink-muted">
            I'll build the cheapest basket across all three apps.
          </Text>
        </View>
      )}
    </View>
  );
}

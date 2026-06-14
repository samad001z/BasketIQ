import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { cardShadow } from "@/lib/theme";

/** Skeleton placeholder rows while results load. */
export function LoadingState() {
  return (
    <View className="gap-3 px-5 pt-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={cardShadow} className="rounded-4xl bg-surface p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 rounded-2xl bg-surface-sunken" />
            <View className="flex-1 gap-2">
              <View className="h-3.5 w-3/5 rounded-full bg-surface-sunken" />
              <View className="h-3 w-2/5 rounded-full bg-surface-sunken" />
            </View>
            <View className="h-5 w-12 rounded-full bg-surface-sunken" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center px-10 pt-24">
      <Text className="text-4xl">🔍</Text>
      <Text className="mt-4 text-center font-sans-semibold text-[16px] text-ink">
        {title}
      </Text>
      {subtitle && (
        <Text className="mt-1.5 text-center font-sans text-[13px] text-ink-muted">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="items-center px-10 pt-24">
      <Text className="text-4xl">⚠️</Text>
      <Text className="mt-4 text-center font-sans-semibold text-[16px] text-ink">
        Something went wrong
      </Text>
      <Text className="mt-1.5 text-center font-sans text-[13px] text-ink-muted">
        {message}
      </Text>
      <PressableScale onPress={onRetry}>
        <Text className="mt-5 rounded-full bg-accent px-6 py-3 font-sans-semibold text-[14px] text-white">
          Try again
        </Text>
      </PressableScale>
    </View>
  );
}

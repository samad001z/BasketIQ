import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cardShadow } from "@/lib/theme";
import { useNotifications } from "@/store/useNotifications";

/** Transient in-app notifications, pinned to the top. Mounted once at root. */
export function Toaster() {
  const insets = useSafeAreaInsets();
  const toasts = useNotifications((s) => s.toasts);
  const dismiss = useNotifications((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, gap: 8 }}
    >
      {toasts.map((t) => (
        <Animated.View key={t.id} entering={FadeInUp} exiting={FadeOutUp}>
          <Pressable onPress={() => dismiss(t.id)}>
            <View
              style={cardShadow}
              className="rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <Text className="font-sans-semibold text-[13px] text-ink">
                {t.title}
              </Text>
              {t.body && (
                <Text className="mt-0.5 font-sans text-[12px] text-ink-soft">
                  {t.body}
                </Text>
              )}
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

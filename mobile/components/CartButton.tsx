import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { cardShadow } from "@/lib/theme";
import { useCartCount } from "@/store/useCartStore";

/** Header cart entry point with a live count badge. */
export function CartButton() {
  const count = useCartCount();
  return (
    <PressableScale onPress={() => router.push("/cart")}>
      <View
        style={cardShadow}
        className="h-11 w-11 items-center justify-center rounded-full bg-surface"
      >
        <Ionicons name="cart-outline" size={22} color="#0E1A13" />
        {count > 0 && (
          <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1">
            <Text className="font-sans-bold text-[10px] text-white">{count}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

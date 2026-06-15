import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import type { Product } from "@/lib/api";
import { cardShadow } from "@/lib/theme";
import { useCartQuantity, useCartStore } from "@/store/useCartStore";

type Props = { product: Product; size?: "sm" | "lg" };

/** Add button that morphs into a − qty + stepper once in the cart. */
export function CartControl({ product, size = "sm" }: Props) {
  const qty = useCartQuantity(product.id);
  const add = useCartStore((s) => s.add);
  const inc = useCartStore((s) => s.inc);
  const dec = useCartStore((s) => s.dec);

  const lg = size === "lg";

  if (qty === 0) {
    return (
      <PressableScale onPress={() => add(product)}>
        {lg ? (
          <View className="items-center rounded-2xl bg-accent py-4">
            <Text className="font-sans-semibold text-[15px] text-white">
              Add to cart
            </Text>
          </View>
        ) : (
          <View
            style={cardShadow}
            className="h-9 w-9 items-center justify-center rounded-full bg-accent"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </View>
        )}
      </PressableScale>
    );
  }

  const btn = lg ? "h-11 w-11" : "h-8 w-8";
  const num = lg ? "text-[18px] min-w-10" : "text-[14px] min-w-7";

  return (
    <View
      className={`flex-row items-center ${lg ? "justify-between rounded-2xl bg-accent-light px-2 py-1.5" : "gap-1 rounded-full bg-accent-light px-1 py-1"}`}
    >
      <PressableScale onPress={() => dec(product.id)}>
        <View className={`${btn} items-center justify-center rounded-full bg-surface`}>
          <Ionicons name="remove" size={lg ? 22 : 18} color="#15803D" />
        </View>
      </PressableScale>
      <Text className={`text-center font-display-bold text-accent-dark ${num}`}>
        {qty}
      </Text>
      <PressableScale onPress={() => inc(product.id)}>
        <View className={`${btn} items-center justify-center rounded-full bg-accent`}>
          <Ionicons name="add" size={lg ? 22 : 18} color="#fff" />
        </View>
      </PressableScale>
    </View>
  );
}

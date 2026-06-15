import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { View } from "react-native";

import type { Product } from "@/lib/api";
import { categoryStyle } from "@/lib/theme";

/**
 * Product thumbnail. Real photo (expo-image, cached + fade) when available;
 * otherwise a soft category-tinted tile with a matching icon — premium, never
 * an empty grey box.
 */
export function ProductThumb({
  product,
  size = 64,
  radius = 16,
}: {
  product: Product | null;
  size?: number;
  radius?: number;
}) {
  const url = product?.image_url;
  if (url) {
    return (
      <Image
        source={url}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#F4F6F4" }}
        contentFit="contain"
        transition={250}
        cachePolicy="memory-disk"
      />
    );
  }
  const s = categoryStyle(product?.category ?? null);
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: s.tile }}
      className="items-center justify-center"
    >
      <Ionicons name={s.ion as any} size={size * 0.42} color={s.fg} />
    </View>
  );
}

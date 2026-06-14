import { Image } from "expo-image";
import { Text, View } from "react-native";

import type { Product } from "@/lib/api";
import { categoryEmoji } from "@/lib/theme";

/**
 * Product thumbnail. Uses expo-image (cached, with a fade-in) when the product
 * has an image_url; otherwise degrades to a clean category glyph. Real images
 * arrive when image_url is populated (Open Food Facts seed / Phase 9 collector).
 */
export function ProductThumb({
  product,
  size = 44,
}: {
  product: Product | null;
  size?: number;
}) {
  const url = product?.image_url;
  if (url) {
    return (
      <Image
        source={url}
        style={{ width: size, height: size, borderRadius: 12 }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-xl bg-surface-sunken"
    >
      <Text style={{ fontSize: size * 0.45 }}>
        {categoryEmoji(product?.category ?? null)}
      </Text>
    </View>
  );
}

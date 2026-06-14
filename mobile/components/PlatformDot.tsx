import { View } from "react-native";

import type { Platform } from "@/lib/api";
import { PLATFORM_META } from "@/lib/theme";

/** Small brand-colored dot — the only place platform color appears. */
export function PlatformDot({ platform, size = 9 }: { platform: Platform; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PLATFORM_META[platform].color,
      }}
    />
  );
}

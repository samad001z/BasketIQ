import { type ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { MOTION } from "@/lib/theme";

type Props = PressableProps & { children: ReactNode };

/** Pressable with a subtle spring scale on press. Honors reduced motion. */
export function PressableScale({ children, ...props }: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.97, MOTION.press);
      }}
      onPressOut={() => {
        if (!reduced) scale.value = withSpring(1, MOTION.press);
      }}
      {...props}
    >
      <Animated.View style={style}>{children}</Animated.View>
    </Pressable>
  );
}

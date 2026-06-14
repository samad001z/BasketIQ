import { Pressable, TextInput, View } from "react-native";

import { cardShadow } from "@/lib/theme";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder }: Props) {
  return (
    <View
      style={cardShadow}
      className="flex-row items-center gap-3 rounded-3xl bg-surface px-4 py-3.5"
    >
      <View className="h-7 w-7 items-center justify-center rounded-full bg-accent-light">
        {/* Lightweight glyph icon — no asset needed */}
        <View className="h-3 w-3 rounded-full border-2 border-accent-dark" />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search milk, coffee, atta…"}
        placeholderTextColor="#8B948D"
        className="flex-1 font-sans text-[15px] text-ink"
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          className="h-6 w-6 items-center justify-center rounded-full bg-surface-sunken"
        >
          <View className="h-0.5 w-3 rounded-full bg-ink-muted" />
        </Pressable>
      )}
    </View>
  );
}

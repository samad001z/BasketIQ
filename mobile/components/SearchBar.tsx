import { Ionicons } from "@expo/vector-icons";
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
      className="flex-row items-center gap-2.5 rounded-2xl bg-surface px-4 py-3.5"
    >
      <Ionicons name="search" size={20} color="#16A34A" />
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
        <Pressable onPress={() => onChangeText("")} hitSlop={10}>
          <Ionicons name="close-circle" size={20} color="#C2C9C3" />
        </Pressable>
      )}
    </View>
  );
}

import { ScrollView, Text } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { categoryEmoji } from "@/lib/theme";

type Props = {
  categories: string[];
  selected: string | null;
  onSelect: (c: string | null) => void;
};

export function CategoryChips({ categories, selected, onSelect }: Props) {
  const items = ["All", ...categories];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
    >
      {items.map((c) => {
        const isAll = c === "All";
        const active = isAll ? selected === null : selected === c;
        return (
          <PressableScale key={c} onPress={() => onSelect(isAll ? null : c)}>
            <Text
              className={`rounded-full px-4 py-2 font-sans-medium text-[13px] ${
                active
                  ? "bg-accent text-white"
                  : "bg-surface text-ink-soft"
              }`}
            >
              {isAll ? "All" : `${categoryEmoji(c)}  ${c}`}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

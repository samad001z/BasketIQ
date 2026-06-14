import { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CartButton } from "@/components/CartButton";
import { CategoryChips } from "@/components/CategoryChips";
import { ResultCard } from "@/components/ResultCard";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import type { Product } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useProducts } from "@/lib/hooks/useProducts";
import { useSearch } from "@/lib/hooks/useSearch";

// Fixed category order for the chips row.
const CATEGORY_ORDER = [
  "Dairy & Eggs",
  "Snacks & Chips",
  "Beverages",
  "Coffee & Tea",
  "Staples",
  "Instant Food",
  "Bakery",
  "Personal Care",
  "Household",
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const isSearching = debounced.trim().length >= 2;

  const products = useProducts();
  const search = useSearch(debounced);

  const categories = useMemo(() => {
    const present = new Set((products.data ?? []).map((p) => p.category ?? ""));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [products.data]);

  const items: Product[] = useMemo(() => {
    if (isSearching) return (search.data?.matches ?? []).map((m) => m.product);
    const all = products.data ?? [];
    return category ? all.filter((p) => p.category === category) : all;
  }, [isSearching, search.data, products.data, category]);

  const isLoading = isSearching ? search.isLoading : products.isLoading;
  const isError = isSearching ? search.isError : products.isError;
  const refetch = () => (isSearching ? search.refetch() : products.refetch());

  return (
    <View className="flex-1 bg-surface-sunken">
      {/* Header + search (fixed; list scrolls beneath) */}
      <View style={{ paddingTop: insets.top + 8 }} className="px-5 pb-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="font-display-bold text-[26px] text-ink">BasketIQ</Text>
            <Text className="mt-0.5 font-sans text-[13px] text-ink-muted">
              Compare Blinkit · Zepto · Instamart — pay the lowest.
            </Text>
          </View>
          <CartButton />
        </View>
        <View className="mt-4">
          <SearchBar value={query} onChangeText={setQuery} />
        </View>
      </View>

      {!isSearching && (
        <View className="pb-1">
          <CategoryChips
            categories={categories}
            selected={category}
            onSelect={setCategory}
          />
        </View>
      )}

      {isError ? (
        <ErrorState
          message="Couldn't reach the BasketIQ API. Check the backend and EXPO_PUBLIC_API_URL."
          onRetry={refetch}
        />
      ) : isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          title={isSearching ? `No matches for “${debounced.trim()}”` : "No products"}
          subtitle={isSearching ? "Try a brand or item name." : undefined}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <ResultCard product={item} index={index} />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 28,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

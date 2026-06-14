import { useQuery } from "@tanstack/react-query";

import { api, type SearchResponse } from "@/lib/api";

const MIN_QUERY_LEN = 2;

/** Semantic search against GET /search. Disabled for short queries. */
export function useSearch(query: string) {
  const q = query.trim();
  const enabled = q.length >= MIN_QUERY_LEN;
  return useQuery<SearchResponse>({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev, // keep last results while typing
  });
}

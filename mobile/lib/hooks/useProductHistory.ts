import { useQuery } from "@tanstack/react-query";

import { api, type ProductHistoryResponse } from "@/lib/api";

/** GET /products/{id}/history — price-over-time per platform. */
export function useProductHistory(id: string | undefined) {
  return useQuery<ProductHistoryResponse>({
    queryKey: ["history", id],
    queryFn: () => api.getProductHistory(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from "@tanstack/react-query";

import { api, type Product } from "@/lib/api";

/** Full catalog (80 items fit in one page). Cached and reused for detail. */
export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.getProducts(1, 100)).items,
    staleTime: 5 * 60 * 1000,
  });
}

/** A single product, read from the cached catalog (shares the query above). */
export function useProduct(id: string | undefined) {
  const query = useProducts();
  return {
    ...query,
    data: id ? query.data?.find((p) => p.id === id) : undefined,
  };
}

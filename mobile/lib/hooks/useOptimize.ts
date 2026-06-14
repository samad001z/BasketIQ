import { useMutation } from "@tanstack/react-query";

import { api, type OptimizeRequestItem, type OptimizeResponse } from "@/lib/api";

/** POST /optimize — compute the cheapest cross-platform split for a cart. */
export function useOptimize() {
  return useMutation<OptimizeResponse, Error, OptimizeRequestItem[]>({
    mutationFn: (items) => api.optimize(items),
  });
}

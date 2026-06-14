import { useMutation } from "@tanstack/react-query";

import { api, type ImageFile, type ScanResponse } from "@/lib/api";

/** POST /scan — upload a cart screenshot → extracted + matched + optimized. */
export function useScan() {
  return useMutation<ScanResponse, Error, ImageFile>({
    mutationFn: (file) => api.scan(file),
  });
}

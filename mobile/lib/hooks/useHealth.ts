import { useQuery } from "@tanstack/react-query";

import { api, type HealthResponse } from "@/lib/api";

/** Phase 1 end-to-end ping hook: app -> FastAPI /health -> Supabase. */
export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: api.getHealth,
  });
}

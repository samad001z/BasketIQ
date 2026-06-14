import { useMutation } from "@tanstack/react-query";

import { api, type AssistantResponse } from "@/lib/api";

type Vars = { message: string; budget?: number | null };

/** POST /assistant — NL request → budget-aware basket + optimized split. */
export function useAssistant() {
  return useMutation<AssistantResponse, Error, Vars>({
    mutationFn: ({ message, budget }) => api.assistant(message, budget),
  });
}

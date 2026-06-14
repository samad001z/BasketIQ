import { create } from "zustand";

/**
 * Global app state (Zustand). Server state lives in React Query, not here.
 * Phase 1 keeps this minimal; cart/user state arrives in later phases.
 */
type AppState = {
  hasOnboarded: boolean;
  setHasOnboarded: (v: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  hasOnboarded: false,
  setHasOnboarded: (v) => set({ hasOnboarded: v }),
}));

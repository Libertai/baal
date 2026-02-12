/**
 * Zustand store for user preferences, persisted with AsyncStorage.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "light" | "dark" | "system";

interface PreferencesState {
  /** Whether to show tool call details in chat. */
  showTools: boolean;
  /** Color scheme preference. */
  theme: ThemePreference;
  /** Last agent the user interacted with. */
  lastActiveAgentId: string | null;

  toggleTools: () => void;
  setTheme: (t: ThemePreference) => void;
  setLastActiveAgent: (id: string | null) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      showTools: true,
      theme: "system",
      lastActiveAgentId: null,

      toggleTools: () => set((s) => ({ showTools: !s.showTools })),
      setTheme: (theme) => set({ theme }),
      setLastActiveAgent: (id) => set({ lastActiveAgentId: id }),
    }),
    {
      name: "liberclaw-preferences",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

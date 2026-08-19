import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UserRole } from "@/api/types";
import { authSecureStorage } from "@/lib/authSecureStorage";

type AuthState = {
  token: string | null;
  role: UserRole | null;
  username: string | null;
  canPlay: boolean | null;
  avatarUrl: string | null;
  uiLocale: string | null;
  setToken: (t: string | null) => void;
  setUiLocale: (locale: string | null) => void;
  setProfile: (
    username: string,
    role: UserRole,
    caps?: { canPlay?: boolean; avatarUrl?: string | null; uiLocale?: string | null },
  ) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      username: null,
      canPlay: null,
      avatarUrl: null,
      uiLocale: null,
      setToken: (t) => set({ token: t }),
      setUiLocale: (uiLocale) => set({ uiLocale }),
      setProfile: (username, role, caps) =>
        set({
          username,
          role,
          ...(caps?.canPlay !== undefined ? { canPlay: caps.canPlay } : {}),
          ...(caps?.avatarUrl !== undefined ? { avatarUrl: caps.avatarUrl } : {}),
          ...(caps?.uiLocale !== undefined ? { uiLocale: caps.uiLocale } : {}),
        }),
      clearSession: () =>
        set({
          token: null,
          role: null,
          username: null,
          canPlay: null,
          avatarUrl: null,
          uiLocale: null,
        }),
    }),
    {
      name: "vauldy-tv-auth",
      storage: createJSONStorage(() => authSecureStorage),
      partialize: (s) => ({
        token: s.token,
        role: s.role,
        username: s.username,
        canPlay: s.canPlay,
        avatarUrl: s.avatarUrl,
        uiLocale: s.uiLocale,
      }),
    },
  ),
);

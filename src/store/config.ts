import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ConfigState = {
  serverUrl: string | null;
  appName: string;
  setServerUrl: (url: string | null) => void;
  setAppName: (name: string) => void;
};

/** Normalize user-entered server address into `http(s)://host:port` (no trailing slash). */
export function normalizeServerUrl(raw: string): string {
  let u = raw
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Full-width punctuation common with Chinese input methods / Bluetooth keyboards
    .replace(/：/g, ":")
    .replace(/．/g, ".")
    .replace(/。/g, ".")
    .replace(/／/g, "/")
    .replace(/\s+/g, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    u = `http://${u}`;
  }
  u = u.replace(/\/+$/, "");
  // Users sometimes paste the API prefix from docs or the web app path
  u = u.replace(/\/api\/v1$/i, "").replace(/\/api$/i, "");
  try {
    const parsed = new URL(u);
    if (!parsed.hostname) return "";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      serverUrl: null,
      appName: "Vauldy",
      setServerUrl: (url) => set({ serverUrl: url ? normalizeServerUrl(url) : null }),
      setAppName: (name) => set({ appName: name || "Vauldy" }),
    }),
    {
      name: "vauldy-tv-config",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

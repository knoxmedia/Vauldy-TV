import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

const TOKEN_KEY = "vauldy-tv-jwt";

type PersistedAuthBlob = {
  state?: {
    token?: string | null;
    [key: string]: unknown;
  };
  version?: number;
};

/**
 * Zustand storage: JWT in SecureStore, remaining auth fields in AsyncStorage.
 * Migrates legacy tokens that were previously persisted inside AsyncStorage.
 */
export const authSecureStorage: StateStorage = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name);
    let parsed: PersistedAuthBlob | null = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw) as PersistedAuthBlob;
      } catch {
        parsed = null;
      }
    }

    let token = await SecureStore.getItemAsync(TOKEN_KEY);
    const legacyToken = parsed?.state?.token;
    if (!token && typeof legacyToken === "string" && legacyToken) {
      token = legacyToken;
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
      } catch {
        /* keep using in-memory / AsyncStorage fallback */
      }
    }

    if (!parsed) {
      if (!token) return null;
      return JSON.stringify({ state: { token }, version: 0 });
    }

    if (!parsed.state) parsed.state = {};
    parsed.state.token = token;
    return JSON.stringify(parsed);
  },

  setItem: async (name, value) => {
    let parsed: PersistedAuthBlob;
    try {
      parsed = JSON.parse(value) as PersistedAuthBlob;
    } catch {
      await AsyncStorage.setItem(name, value);
      return;
    }

    const token = parsed.state?.token;
    if (typeof token === "string" && token) {
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      } catch {
        /* ignore */
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } catch {
        /* ignore */
      }
    }

    if (parsed.state) {
      const { token: _drop, ...rest } = parsed.state;
      parsed.state = rest;
    }
    await AsyncStorage.setItem(name, JSON.stringify(parsed));
  },

  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(name);
  },
};

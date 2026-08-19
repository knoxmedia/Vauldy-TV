import AsyncStorage from "@react-native-async-storage/async-storage";

export const SEARCH_HISTORY_KEY = "@vauldy/search-history";
export const SEARCH_HISTORY_LIMIT = 10;

export function normalizeSearchHistory(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length === SEARCH_HISTORY_LIMIT) break;
  }
  return result;
}

export function addSearchHistoryEntry(history: readonly string[], query: string): string[] {
  return normalizeSearchHistory([query, ...history]);
}

export async function loadSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? normalizeSearchHistory(parsed.filter((item): item is string => typeof item === "string"))
      : [];
  } catch {
    return [];
  }
}

export async function saveSearchHistory(history: readonly string[]): Promise<string[]> {
  const normalized = normalizeSearchHistory(history);
  await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function recordSearchHistory(history: readonly string[], query: string): Promise<string[]> {
  return saveSearchHistory(addSearchHistoryEntry(history, query));
}

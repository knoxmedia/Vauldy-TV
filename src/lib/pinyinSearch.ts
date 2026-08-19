import { pinyin } from "pinyin-pro";
import type { MediaItem } from "@/api/types";

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when a query should be augmented with Chinese pinyin matching. */
export function isInitialSearchQuery(query: string): boolean {
  const normalized = compact(query);
  return normalized.length > 0 && normalized === query.toLowerCase().replace(/\s+/g, "");
}

/** Build full-pinyin and first-letter keys for a title. */
export function titlePinyinKeys(title: string): { full: string; initials: string } {
  const text = (title || "").trim();
  if (!text) return { full: "", initials: "" };
  return {
    full: compact(pinyin(text, { toneType: "none", type: "array" }).join("")),
    initials: compact(pinyin(text, { pattern: "first", toneType: "none", type: "array" }).join("")),
  };
}


export type IndexedMediaTitle = {
  item: MediaItem;
  searchKey: string;
};

export function indexMediaTitle(item: MediaItem): IndexedMediaTitle {
  const titles = [item.title, item.original_title || "", item.file_path || ""];
  const parts: string[] = [];
  for (const title of titles) {
    const keys = titlePinyinKeys(title);
    parts.push(compact(title), keys.initials, keys.full);
  }
  return { item, searchKey: parts.join("|") };
}

export function indexedMediaMatches(entry: IndexedMediaTitle, query: string): boolean {
  const needle = compact(query);
  return needle.length > 0 && entry.searchKey.includes(needle);
}

/** Build the pinyin index in small chunks so TV remote events keep flowing. */
export async function indexMediaCatalog(
  items: MediaItem[],
  batchSize = 30,
): Promise<IndexedMediaTitle[]> {
  const result: IndexedMediaTitle[] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const end = Math.min(items.length, start + batchSize);
    for (let i = start; i < end; i++) result.push(indexMediaTitle(items[i]!));
    if (end < items.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return result;
}

export function mediaMatchesPinyin(item: MediaItem, query: string): boolean {
  const needle = compact(query);
  if (!needle) return false;
  const titles = [item.title, item.original_title || "", item.file_path || ""];
  return titles.some((title) => {
    const direct = compact(title);
    if (direct.includes(needle)) return true;
    const keys = titlePinyinKeys(title);
    return keys.initials.includes(needle) || keys.full.includes(needle);
  });
}

export function mergeMediaResults(primary: MediaItem[], supplemental: MediaItem[]): MediaItem[] {
  const seen = new Set<number>();
  const result: MediaItem[] = [];
  for (const item of [...primary, ...supplemental]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

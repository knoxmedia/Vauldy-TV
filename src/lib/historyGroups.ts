type HistoryLike = { update_at?: string; last_play_at?: string; play_end_at?: string; play_start_at?: string };

export type HistoryGroupKey = "today" | "week" | "earlier";

export function historyItemTime(item: HistoryLike): number {
  const raw = item.update_at || item.last_play_at || item.play_end_at || item.play_start_at || "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function historyGroupKey(item: HistoryLike, now = Date.now()): HistoryGroupKey {
  const ms = historyItemTime(item);
  if (!ms) return "earlier";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000;
  if (ms >= startOfToday.getTime()) return "today";
  if (ms >= weekAgo) return "week";
  return "earlier";
}

export function groupHistoryItems<T extends HistoryLike>(
  items: readonly T[],
  now = Date.now(),
): { key: HistoryGroupKey; items: T[] }[] {
  const buckets: Record<HistoryGroupKey, T[]> = { today: [], week: [], earlier: [] };
  const sorted = [...items].sort((a, b) => historyItemTime(b) - historyItemTime(a));
  for (const item of sorted) {
    buckets[historyGroupKey(item, now)].push(item);
  }
  const order: HistoryGroupKey[] = ["today", "week", "earlier"];
  return order.filter((key) => buckets[key].length > 0).map((key) => ({ key, items: buckets[key] }));
}

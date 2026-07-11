import type { EpisodeRow, SeasonSummary } from "@/api/types";
import { fetchSeasonEpisodes } from "@/api/client";

export type SeriesPlaySession = {
  seriesId: number;
  order: number[];
};

export function pickPrimaryEpisodeMediaId(ep: EpisodeRow): number | null {
  const versions = ep.versions ?? [];
  if (versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const mid = sorted[0]?.media_id;
  return mid != null && mid > 0 ? mid : null;
}

export function primaryMediaIdsFromEpisodes(items: EpisodeRow[]): number[] {
  const sorted = [...items].sort((a, b) => a.episode_num - b.episode_num);
  const out: number[] = [];
  for (const ep of sorted) {
    const mid = pickPrimaryEpisodeMediaId(ep);
    if (mid != null) out.push(mid);
  }
  return out;
}

export function resolveNextSeriesMedia(
  session: SeriesPlaySession,
  currentMediaId: number,
  currentIndex: number | null,
): { mediaId: number; index: number } | null {
  const { order } = session;
  let pos = currentIndex;
  if (pos == null || pos < 0 || pos >= order.length || order[pos] !== currentMediaId) {
    pos = order.indexOf(currentMediaId);
  }
  if (pos < 0 || pos + 1 >= order.length) return null;
  const nextIndex = pos + 1;
  return { mediaId: order[nextIndex]!, index: nextIndex };
}

export async function fetchSeriesEpisodeMediaOrder(seasons: SeasonSummary[]): Promise<number[]> {
  const order: number[] = [];
  const sortedSeasons = [...seasons].sort((a, b) => a.season_num - b.season_num);
  for (const season of sortedSeasons) {
    let items: EpisodeRow[] = [];
    try {
      items = await fetchSeasonEpisodes(season.id);
    } catch {
      continue;
    }
    order.push(...primaryMediaIdsFromEpisodes(items));
  }
  return order;
}

export function episodeIsCompleted(ep: EpisodeRow): boolean {
  const mid = pickPrimaryEpisodeMediaId(ep);
  if (mid == null) return false;
  const versions = ep.versions ?? [];
  const v = versions.find((x) => x.media_id === mid) ?? versions[0];
  return (v?.completed ?? 0) > 0;
}

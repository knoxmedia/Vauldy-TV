import type { EpisodeRow, SeasonSummary } from "@/api/types";
import { fetchSeasonEpisodes } from "@/api/client";

export type EpisodeMeta = { seasonId: number; episodeNum: number };
export type SeriesPlaySession = {
  seriesId: number;
  order: number[];
  episodes: Record<number, EpisodeMeta>;
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
): { mediaId: number; index: number; seasonId?: number; episodeNum?: number } | null {
  const { order, episodes } = session;
  let pos = currentIndex;
  if (pos == null || pos < 0 || pos >= order.length || order[pos] !== currentMediaId) {
    pos = order.indexOf(currentMediaId);
  }
  if (pos < 0 || pos + 1 >= order.length) return null;
  const nextIndex = pos + 1;
  const nextMediaId = order[nextIndex]!;
  const meta = episodes[nextMediaId];
  return { mediaId: nextMediaId, index: nextIndex, seasonId: meta?.seasonId, episodeNum: meta?.episodeNum };
}

export async function fetchSeriesEpisodeMediaOrder(
  seasons: SeasonSummary[],
): Promise<{ order: number[]; episodes: Record<number, EpisodeMeta> }> {
  const order: number[] = [];
  const episodes: Record<number, EpisodeMeta> = {};
  const sortedSeasons = [...seasons].sort((a, b) => a.season_num - b.season_num);
  for (const season of sortedSeasons) {
    let items: EpisodeRow[] = [];
    try {
      items = await fetchSeasonEpisodes(season.id);
    } catch {
      continue;
    }
    const sortedItems = [...items].sort((a, b) => a.episode_num - b.episode_num);
    for (const ep of sortedItems) {
      const mid = pickPrimaryEpisodeMediaId(ep);
      if (mid != null && mid > 0) {
        order.push(mid);
        episodes[mid] = { seasonId: season.id, episodeNum: ep.episode_num };
      }
    }
  }
  return { order, episodes };
}

export function episodeIsCompleted(ep: EpisodeRow): boolean {
  const mid = pickPrimaryEpisodeMediaId(ep);
  if (mid == null) return false;
  const versions = ep.versions ?? [];
  const v = versions.find((x) => x.media_id === mid) ?? versions[0];
  return (v?.completed ?? 0) > 0;
}

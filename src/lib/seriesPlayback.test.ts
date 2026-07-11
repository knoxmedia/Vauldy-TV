import { describe, expect, it } from "vitest";
import {
  pickPrimaryEpisodeMediaId,
  resolveNextSeriesMedia,
  primaryMediaIdsFromEpisodes,
} from "./seriesPlayback";
import type { EpisodeRow } from "@/api/types";

describe("pickPrimaryEpisodeMediaId", () => {
  it("picks lowest sort_order version", () => {
    const ep: EpisodeRow = {
      id: 1,
      episode_num: 1,
      versions: [
        { media_id: 20, sort_order: 2 },
        { media_id: 10, sort_order: 1 },
      ],
    };
    expect(pickPrimaryEpisodeMediaId(ep)).toBe(10);
  });

  it("returns null when no versions", () => {
    expect(pickPrimaryEpisodeMediaId({ id: 1, episode_num: 1, versions: [] })).toBeNull();
  });
});

describe("primaryMediaIdsFromEpisodes", () => {
  it("sorts by episode_num and skips empty versions", () => {
    const items: EpisodeRow[] = [
      { id: 2, episode_num: 2, versions: [{ media_id: 200 }] },
      { id: 1, episode_num: 1, versions: [{ media_id: 100 }] },
      { id: 3, episode_num: 3, versions: [] },
    ];
    expect(primaryMediaIdsFromEpisodes(items)).toEqual([100, 200]);
  });
});

describe("resolveNextSeriesMedia", () => {
  const session = { seriesId: 5, order: [10, 20, 30] };

  it("returns next by index", () => {
    expect(resolveNextSeriesMedia(session, 10, 0)).toEqual({ mediaId: 20, index: 1 });
  });

  it("returns null on last", () => {
    expect(resolveNextSeriesMedia(session, 30, 2)).toBeNull();
  });

  it("finds by media id when index wrong", () => {
    expect(resolveNextSeriesMedia(session, 20, null)).toEqual({ mediaId: 30, index: 2 });
  });
});

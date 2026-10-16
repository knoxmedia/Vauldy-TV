import { create } from "zustand";
import type { EpisodeMeta, SeriesPlaySession } from "@/lib/seriesPlayback";

type SeriesPlayState = {
  session: SeriesPlaySession | null;
  // Media ids finished in THIS app session. The history API excludes completed
  // entries (`WHERE completed = 0`), so series screens merge this local set to
  // show the "watched" badge immediately after playback ends.
  completedMediaIds: ReadonlySet<number>;
  setSession: (seriesId: number, order: number[], episodes: Record<number, EpisodeMeta>) => void;
  clearSession: () => void;
  markCompleted: (mediaId: number) => void;
};

export const useSeriesPlayStore = create<SeriesPlayState>((set) => ({
  session: null,
  completedMediaIds: new Set<number>(),
  setSession: (seriesId, order, episodes) =>
    set({ session: { seriesId, order: order.filter((id) => id > 0), episodes } }),
  clearSession: () => set({ session: null }),
  markCompleted: (mediaId) =>
    set((state) => {
      if (mediaId <= 0 || state.completedMediaIds.has(mediaId)) return state;
      const next = new Set(state.completedMediaIds);
      next.add(mediaId);
      return { completedMediaIds: next };
    }),
}));

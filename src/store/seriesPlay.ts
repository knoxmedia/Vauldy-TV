import { create } from "zustand";
import type { EpisodeMeta, SeriesPlaySession } from "@/lib/seriesPlayback";

type SeriesPlayState = {
  session: SeriesPlaySession | null;
  setSession: (seriesId: number, order: number[], episodes: Record<number, EpisodeMeta>) => void;
  clearSession: () => void;
};

export const useSeriesPlayStore = create<SeriesPlayState>((set) => ({
  session: null,
  setSession: (seriesId, order, episodes) =>
    set({ session: { seriesId, order: order.filter((id) => id > 0), episodes } }),
  clearSession: () => set({ session: null }),
}));

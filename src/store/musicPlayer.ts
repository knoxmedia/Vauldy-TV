import { create } from "zustand";

export type MusicTrack = {
  mediaId: number;
  title: string;
  artist: string;
  albumTitle: string;
  albumId?: number;
  duration?: number;
  coverUri: string;
  playUri: string;
};

type EngineHandlers = {
  togglePlay: () => Promise<void>;
  seekBy: (deltaSec: number) => Promise<void>;
  seekTo: (sec: number) => Promise<void>;
  pausePlay: () => Promise<void>;
  resumePlay: () => Promise<void>;
  unload: () => Promise<void>;
};

function trackFields(track: MusicTrack) {
  return {
    mediaId: track.mediaId,
    title: track.title,
    artist: track.artist,
    albumTitle: track.albumTitle,
    coverUri: track.coverUri,
    playUri: track.playUri,
    duration: track.duration ?? 0,
  };
}

type MusicPlayerState = {
  active: boolean;
  fullscreen: boolean;
  lyricsExpanded: boolean;
  previewBarHidden: boolean;
  videoPausedMusic: boolean;
  wasPlayingBeforeVideo: boolean;
  queue: MusicTrack[];
  queueIndex: number;
  mediaId: number | null;
  title: string;
  artist: string;
  albumTitle: string;
  coverUri: string;
  playUri: string;
  playing: boolean;
  position: number;
  duration: number;
  handlers: EngineHandlers | null;
  registerHandlers: (handlers: EngineHandlers | null) => void;
  playQueue: (tracks: MusicTrack[], startIndex?: number) => void;
  playTrack: (track: MusicTrack, queue?: MusicTrack[], index?: number) => void;
  start: (track: MusicTrack) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  onTrackEnded: () => void;
  setFullscreen: (fullscreen: boolean) => void;
  setLyricsExpanded: (expanded: boolean) => void;
  setPreviewBarHidden: (hidden: boolean) => void;
  pauseForVideo: () => void;
  resumeAfterVideo: () => void;
  toggle: () => void;
  seekBy: (deltaSec: number) => void;
  setPlaying: (playing: boolean) => void;
  syncPlayback: (position: number, duration: number) => void;
  isBarVisible: () => boolean;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
};

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  active: false,
  fullscreen: false,
  lyricsExpanded: false,
  previewBarHidden: false,
  videoPausedMusic: false,
  wasPlayingBeforeVideo: false,
  queue: [],
  queueIndex: 0,
  mediaId: null,
  title: "",
  artist: "",
  albumTitle: "",
  coverUri: "",
  playUri: "",
  playing: false,
  position: 0,
  duration: 0,
  handlers: null,

  registerHandlers: (handlers) => set({ handlers }),

  playQueue: (tracks, startIndex = 0) => {
    const queue = tracks.filter((track) => track.mediaId > 0);
    if (queue.length === 0) return;
    const idx = Math.max(0, Math.min(startIndex, queue.length - 1));
    const track = queue[idx]!;
    set({
      active: true,
      queue,
      queueIndex: idx,
      ...trackFields(track),
      playing: true,
      position: 0,
    });
  },

  playTrack: (track, queue, index) => {
    const q = queue && queue.length > 0 ? queue : [track];
    const filtered = q.filter((item) => item.mediaId > 0);
    if (filtered.length === 0) return;
    // Always resolve index by mediaId in the filtered array to avoid
    // off-by-one when filtering removed earlier entries.
    const idx = Math.max(
      0,
      filtered.findIndex((item) => item.mediaId === track.mediaId),
    );
    const safeIdx = Math.max(0, Math.min(idx, filtered.length - 1));
    const current = filtered[safeIdx]!;
    set({
      active: true,
      queue: filtered,
      queueIndex: safeIdx,
      ...trackFields(current),
      playing: true,
      position: 0,
    });
  },

  start: (track) => {
    get().playTrack(track);
  },

  stop: () => {
    void get().handlers?.unload();
    set({
      active: false,
      fullscreen: false,
      lyricsExpanded: false,
      previewBarHidden: false,
      videoPausedMusic: false,
      wasPlayingBeforeVideo: false,
      queue: [],
      queueIndex: 0,
      mediaId: null,
      title: "",
      artist: "",
      albumTitle: "",
      coverUri: "",
      playUri: "",
      playing: false,
      position: 0,
      duration: 0,
    });
  },

  next: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0 || queueIndex + 1 >= queue.length) return;
    const nextIndex = queueIndex + 1;
    const track = queue[nextIndex]!;
    set({
      queueIndex: nextIndex,
      ...trackFields(track),
      playing: true,
      position: 0,
    });
  },

  prev: () => {
    const { queue, queueIndex, position } = get();
    if (queue.length === 0) return;
    if (position > 3) {
      void get().handlers?.seekTo(0);
      set({ position: 0, playing: true });
      return;
    }
    if (queueIndex <= 0) return;
    const prevIndex = queueIndex - 1;
    const track = queue[prevIndex]!;
    set({
      queueIndex: prevIndex,
      ...trackFields(track),
      playing: true,
      position: 0,
    });
  },

  onTrackEnded: () => {
    const { queue, queueIndex } = get();
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      const track = queue[nextIndex]!;
      set({
        queueIndex: nextIndex,
        ...trackFields(track),
        playing: true,
        position: 0,
      });
      return;
    }
    set({ playing: false, position: 0 });
  },

  setFullscreen: (fullscreen) => set({ fullscreen }),

  setLyricsExpanded: (lyricsExpanded) => set({ lyricsExpanded }),

  setPreviewBarHidden: (hidden) =>
    set({
      previewBarHidden: hidden,
      ...(hidden ? { lyricsExpanded: false } : {}),
    }),

  pauseForVideo: () => {
    const state = get();
    if (!state.active) return;
    const wasPlaying = state.playing;
    void state.handlers?.pausePlay();
    set({
      videoPausedMusic: true,
      wasPlayingBeforeVideo: wasPlaying,
      lyricsExpanded: false,
      ...(wasPlaying ? { playing: false } : {}),
    });
  },

  resumeAfterVideo: () => {
    const state = get();
    if (!state.active || !state.videoPausedMusic) {
      set({ videoPausedMusic: false, wasPlayingBeforeVideo: false });
      return;
    }
    if (state.wasPlayingBeforeVideo) void state.handlers?.resumePlay();
    set({ videoPausedMusic: false, wasPlayingBeforeVideo: false });
  },

  toggle: () => {
    void get().handlers?.togglePlay();
  },

  seekBy: (deltaSec) => {
    void get().handlers?.seekBy(deltaSec);
  },

  setPlaying: (playing) => set({ playing }),

  syncPlayback: (position, duration) => set({ position, duration }),

  isBarVisible: () => {
    const state = get();
    return (
      state.active &&
      !state.fullscreen &&
      !state.previewBarHidden &&
      !state.videoPausedMusic &&
      state.mediaId !== null
    );
  },

  canGoNext: () => {
    const { queue, queueIndex } = get();
    return queue.length > 0 && queueIndex + 1 < queue.length;
  },

  canGoPrev: () => {
    const { queue, queueIndex, position } = get();
    return queue.length > 0 && (position > 3 || queueIndex > 0);
  },
}));

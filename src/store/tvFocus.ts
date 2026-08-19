import { create } from "zustand";
import type { TvKeyEvent } from "@/hooks/tvKeyDispatcher";

export type TvFocusZone = "sidebar" | "back" | "content" | "musicbar";

/** Return true when the key was handled. */
export type TvContentKeyHandler = (evt: TvKeyEvent) => boolean;

type TvFocusState = {
  zone: TvFocusZone;
  setZone: (zone: TvFocusZone) => void;
  /** Sidebar highlight index (0=home … history … settings). */
  sidebarIndex: number;
  setSidebarIndex: (index: number) => void;
  /** Active main-tab content handler — only the focused screen registers. */
  contentKeyHandler: TvContentKeyHandler | null;
  setContentKeyHandler: (handler: TvContentKeyHandler | null) => void;
  /** Registered by focused screen's TvBackButton. */
  backHandler: (() => void) | null;
  registerBack: (handler: () => void) => void;
  unregisterBack: (handler: () => void) => void;
  /** Set by FloatingMusicBar when the mini bar is on screen. */
  musicBarVisible: boolean;
  setMusicBarVisible: (visible: boolean) => void;
  /** Move focus upward from content: back button if present. */
  exitContentUp: () => boolean;
  /** Move focus downward from content: music bar if present. */
  exitContentDown: () => boolean;
};

export const useTvFocusStore = create<TvFocusState>((set, get) => ({
  zone: "content",
  setZone: (zone) => set({ zone }),
  sidebarIndex: 0,
  setSidebarIndex: (sidebarIndex) => set({ sidebarIndex }),
  contentKeyHandler: null,
  setContentKeyHandler: (contentKeyHandler) => set({ contentKeyHandler }),
  backHandler: null,
  registerBack: (handler) => set({ backHandler: handler }),
  unregisterBack: (handler) => {
    if (get().backHandler === handler) set({ backHandler: null });
  },
  musicBarVisible: false,
  setMusicBarVisible: (musicBarVisible) => set({ musicBarVisible }),
  exitContentUp: () => {
    if (get().backHandler) {
      set({ zone: "back" });
      return true;
    }
    return false;
  },
  exitContentDown: () => {
    if (get().musicBarVisible) {
      set({ zone: "musicbar" });
      return true;
    }
    return false;
  },
}));

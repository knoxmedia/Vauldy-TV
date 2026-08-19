import { create } from "zustand";

export type ContentFocusSnapshot = {
  shelf?: number;
  index: number;
};

type ContentFocusState = {
  memory: Record<string, ContentFocusSnapshot>;
  save: (key: string, snapshot: ContentFocusSnapshot) => void;
  peek: (key: string) => ContentFocusSnapshot | null;
  clear: (key: string) => void;
};

/** Remember list/shelf selection when pushing detail/player routes. */
export const useContentFocusStore = create<ContentFocusState>((set, get) => ({
  memory: {},
  save: (key, snapshot) =>
    set((s) => ({
      memory: { ...s.memory, [key]: { shelf: snapshot.shelf, index: Math.max(0, snapshot.index) } },
    })),
  peek: (key) => get().memory[key] ?? null,
  clear: (key) =>
    set((s) => {
      if (!(key in s.memory)) return s;
      const next = { ...s.memory };
      delete next[key];
      return { memory: next };
    }),
}));

export function saveContentFocus(key: string, snapshot: ContentFocusSnapshot) {
  useContentFocusStore.getState().save(key, snapshot);
}

export function peekContentFocus(key: string): ContentFocusSnapshot | null {
  return useContentFocusStore.getState().peek(key);
}

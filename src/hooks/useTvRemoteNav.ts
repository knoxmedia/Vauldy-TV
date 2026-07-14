import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { consumeTvKeyEvent, registerTvKeyHandler, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";

export const TV_NAV_ENABLED = Platform.OS === "android" || Platform.isTV;

type BaseOpts = {
  count: number;
  enabled?: boolean;
  requireScreenFocus?: boolean;
  initialIndex?: number;
  onSelect?: (index: number) => void;
  onIndexChange?: (index: number) => void;
  onExitLeft?: () => void;
  onExitUp?: () => void;
  onExitDown?: () => void;
};

type GridOpts = BaseOpts & {
  mode: "grid";
  columns: number;
};

type LinearOpts = BaseOpts & {
  mode: "horizontal" | "vertical";
};

type ControlOpts = {
  mode: "controls";
  count: number;
  enabled?: boolean;
  requireScreenFocus?: boolean;
  initialIndex?: number;
  loop?: boolean;
  onSelect?: (index: number) => void;
  onIndexChange?: (index: number) => void;
  onExitUp?: () => void;
  onExitDown?: () => void;
  onExitLeft?: () => void;
};

export type TvRemoteNavOpts = GridOpts | LinearOpts | ControlOpts;

function clampIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, index));
}

export function useTvRemoteNav(opts: TvRemoteNavOpts) {
  const {
    count,
    enabled = TV_NAV_ENABLED,
    requireScreenFocus = true,
    initialIndex = 0,
    onSelect,
    onIndexChange,
  } = opts;
  const screenFocused = useIsFocused();
  const [index, setIndex] = useState(() => clampIndex(initialIndex, count));
  const indexRef = useRef(index);
  indexRef.current = index;
  // Render-confirmed ref — updated ONLY by React render.
  // onSelect reads this so it always matches the visual highlight.
  const indexConfirmed = useRef(index);
  indexConfirmed.current = index;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onExitLeftRef = useRef(opts.onExitLeft);
  onExitLeftRef.current = opts.onExitLeft;
  const onExitUpRef = useRef(opts.onExitUp);
  onExitUpRef.current = opts.onExitUp;
  const onExitDownRef = useRef(opts.onExitDown);
  onExitDownRef.current = opts.onExitDown;

  // Safe ref updates via useLayoutEffect (runs synchronously after commit).
  const enabledRef = useRef(enabled);
  const screenFocusedRef = useRef(screenFocused);
  useLayoutEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useLayoutEffect(() => {
    screenFocusedRef.current = screenFocused;
  }, [screenFocused]);

  useEffect(() => {
    setIndex((prev) => clampIndex(prev, count));
  }, [count]);

  const moveTo = useCallback(
    (next: number) => {
      const clamped = clampIndex(next, count);
      indexRef.current = clamped;
      setIndex(clamped);
      onIndexChange?.(clamped);
    },
    [count, onIndexChange],
  );

  const moveToRef = useRef(moveTo);
  moveToRef.current = moveTo;

  const countRef = useRef(count);
  countRef.current = count;
  const modeRef = useRef(opts.mode);
  modeRef.current = opts.mode;
  const loopRef = useRef((opts as ControlOpts).loop ?? true);
  loopRef.current = (opts as ControlOpts).loop ?? true;
  const columnsRef = useRef((opts as GridOpts).columns);
  columnsRef.current = (opts as GridOpts).columns;

  useEffect(() => {
    const handler = (evt: TvKeyEvent) => {
      // Guard: skip if a priority handler (MainShellTvNav) already consumed the event.
      if (evt._consumed) return;
      // Check enabled fresh on every event via refs.
      if (!enabledRef.current) return;
      if (countRef.current <= 0) return;
      if (requireScreenFocus && !screenFocusedRef.current) return;

      const type = evt.eventType;
      if (type === "focus" || type === "blur") return;
      const current = indexRef.current;
      const cnt = countRef.current;
      const mode = modeRef.current;

      if (type === "select") {
        consumeTvKeyEvent(evt);
        // Use confirmed ref so selected item matches visual highlight.
        onSelectRef.current?.(indexConfirmed.current);
        return;
      }

      if (mode === "horizontal") {
        if (type === "left") {
          if (current <= 0) {
            consumeTvKeyEvent(evt);
            onExitLeftRef.current?.();
          } else {
            consumeTvKeyEvent(evt);
            moveToRef.current(current - 1);
          }
        }
        if (type === "right") {
          consumeTvKeyEvent(evt);
          moveToRef.current(current + 1);
        }
        if (type === "up") {
          consumeTvKeyEvent(evt);
          onExitUpRef.current?.();
        }
        if (type === "down") {
          consumeTvKeyEvent(evt);
          onExitDownRef.current?.();
        }
        return;
      }

      if (mode === "vertical") {
        if (type === "up") {
          if (current <= 0) {
            consumeTvKeyEvent(evt);
            onExitUpRef.current?.();
          } else {
            consumeTvKeyEvent(evt);
            moveToRef.current(current - 1);
          }
        }
        if (type === "down") {
          if (current >= cnt - 1) {
            consumeTvKeyEvent(evt);
            onExitDownRef.current?.();
          } else {
            consumeTvKeyEvent(evt);
            moveToRef.current(current + 1);
          }
        }
        if (type === "left") {
          consumeTvKeyEvent(evt);
          onExitLeftRef.current?.();
        }
        return;
      }

      if (mode === "grid") {
        const columns = columnsRef.current;
        const row = Math.floor(current / columns);
        const col = current % columns;
        const maxRow = Math.floor((cnt - 1) / columns);

        if (type === "left") {
          if (col > 0) {
            consumeTvKeyEvent(evt);
            moveToRef.current(current - 1);
          } else {
            consumeTvKeyEvent(evt);
            onExitLeftRef.current?.();
          }
        }
        if (type === "right" && col < columns - 1 && current + 1 < cnt) {
          consumeTvKeyEvent(evt);
          moveToRef.current(current + 1);
        }
        if (type === "up") {
          if (row > 0) {
            consumeTvKeyEvent(evt);
            moveToRef.current(current - columns);
          } else {
            consumeTvKeyEvent(evt);
            onExitUpRef.current?.();
          }
        }
        if (type === "down") {
          if (row < maxRow && current + columns < cnt) {
            consumeTvKeyEvent(evt);
            moveToRef.current(current + columns);
          } else {
            consumeTvKeyEvent(evt);
            onExitDownRef.current?.();
          }
        }
        return;
      }

      if (mode === "controls") {
        const loop = loopRef.current;
        if (type === "left") {
          consumeTvKeyEvent(evt);
          if (current > 0) moveToRef.current(current - 1);
          else if (loop) moveToRef.current(cnt - 1);
          else onExitLeftRef.current?.();
        }
        if (type === "right") {
          consumeTvKeyEvent(evt);
          if (current < cnt - 1) moveToRef.current(current + 1);
          else if (loop) moveToRef.current(0);
        }
        if (type === "up") {
          consumeTvKeyEvent(evt);
          onExitUpRef.current?.();
        }
        if (type === "down") {
          consumeTvKeyEvent(evt);
          onExitDownRef.current?.();
        }
      }
    };

    return registerTvKeyHandler(handler);
    // Re-register only when mode changes (rare). All dynamic values are read via refs.
  }, []);

  const active = enabled && count > 0 && (!requireScreenFocus || screenFocused);
  return { index: active ? index : -1, setIndex: moveTo, active };
}

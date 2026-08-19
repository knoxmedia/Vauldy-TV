import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchContinueWatchingHistory, fetchLibraries, fetchMedia } from "@/api/client";
import type { HistoryItem, Library, MediaItem } from "@/api/types";
import HorizontalShelf from "@/components/focus/HorizontalShelf";
import LoadingState, { Screen } from "@/components/LoadingState";
import LibraryCard from "@/components/media/LibraryCard";
import MediaCard from "@/components/media/MediaCard";
import { colors, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import { tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { ensureCanPlay } from "@/lib/playbackGate";
import { useConfigStore } from "@/store/config";
import { peekContentFocus, saveContentFocus } from "@/store/contentFocus";
import { useMusicPlayerStore } from "@/store/musicPlayer";
import { useTvFocusStore } from "@/store/tvFocus";

const FOCUS_KEY = "home";

function historyToMediaItem(h: HistoryItem): MediaItem {
  return {
    id: h.media_id,
    library_id: h.library_id ?? 0,
    file_id: h.file_id ?? "",
    title: h.title,
    file_path: h.file_path ?? "",
    file_type: h.file_type || "video",
    duration: h.duration,
    width: 0,
    height: 0,
    format: "",
    status: "",
    poster_url: h.poster_url,
    backdrop_url: h.backdrop_url,
    encrypted_asset: h.encrypted_asset,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const appName = useConfigStore((s) => s.appName);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recent, setRecent] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const exitContentUp = useTvFocusStore((s) => s.exitContentUp);
  const exitContentDown = useTvFocusStore((s) => s.exitContentDown);

  const [activeShelf, setActiveShelf] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);

  const hasHistory = history.length > 0;
  const hasRecent = recent.length > 0;
  const librariesShelfIndex = hasHistory ? 1 : 0;
  const recentShelfIndex = librariesShelfIndex + 1;

  // Immediate refs 鈥?updated ONLY by key handlers / restore, never clobbered from state
  // during render (rapid D-pad repeats would otherwise lose focus steps).
  const activeShelfRef = useRef(activeShelf);
  const itemIndexRef = useRef(itemIndex);
  const historyRef = useRef(history);
  historyRef.current = history;
  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;
  const recentRef = useRef(recent);
  recentRef.current = recent;
  const routerRef = useRef(router);
  routerRef.current = router;
  const setZoneRef = useRef(setZone);
  setZoneRef.current = setZone;
  const exitContentUpRef = useRef(exitContentUp);
  exitContentUpRef.current = exitContentUp;
  const exitContentDownRef = useRef(exitContentDown);
  exitContentDownRef.current = exitContentDown;
  const hasHistoryRef = useRef(hasHistory);
  hasHistoryRef.current = hasHistory;
  const hasRecentRef = useRef(hasRecent);
  hasRecentRef.current = hasRecent;
  const librariesShelfIndexRef = useRef(librariesShelfIndex);
  librariesShelfIndexRef.current = librariesShelfIndex;
  const recentShelfIndexRef = useRef(recentShelfIndex);
  recentShelfIndexRef.current = recentShelfIndex;

  const load = useCallback(async () => {
    const [libR, histR] = await Promise.allSettled([
      fetchLibraries(),
      fetchContinueWatchingHistory(24),
    ]);

    const libs = libR.status === "fulfilled" ? libR.value : [];
    setLibraries(libs.filter((l) => l.enabled !== 0));
    const hist = histR.status === "fulfilled" ? histR.value : [];
    setHistory(hist);

    if (libs.length === 0) {
      setRecent([]);
      return;
    }

    const recentItems: MediaItem[] = [];
    for (const lib of libs.slice(0, 3)) {
      try {
        recentItems.push(...(await fetchMedia(lib.id, { sort: "created_desc", limit: 8 })));
      } catch {
        /* keep partial recent list */
      }
    }
    setRecent(recentItems.slice(0, 12));
  }, []);

  const pendingRestore = useRef(peekContentFocus(FOCUS_KEY));
  const didApplyFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setZone("content");
      pendingRestore.current = peekContentFocus(FOCUS_KEY);
      didApplyFocus.current = false;
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load, setZone]),
  );

  // Apply focus restore / default once per visit after data is ready 鈥?do not reset
  // on later shelf-count changes while the user is already navigating.
  useEffect(() => {
    if (loading || didApplyFocus.current) return;
    didApplyFocus.current = true;
    const saved = pendingRestore.current;
    pendingRestore.current = null;
    const maxShelf = (hasHistory ? 1 : 0) + (hasRecent ? 1 : 0);
    if (saved) {
      const shelf = Math.max(0, Math.min(saved.shelf ?? 0, maxShelf));
      const nextIndex = Math.max(0, saved.index);
      activeShelfRef.current = shelf;
      itemIndexRef.current = nextIndex;
      setActiveShelf(shelf);
      setItemIndex(nextIndex);
      return;
    }
    const libShelf = hasHistory ? librariesShelfIndex : 0;
    activeShelfRef.current = libShelf;
    itemIndexRef.current = 0;
    setActiveShelf(libShelf);
    setItemIndex(0);
  }, [loading, hasHistory, hasRecent, librariesShelfIndex]);

  useMainContentNav(
    useCallback((evt: TvKeyEvent) => {
      const type = tvNavigationEventType(evt.eventType);
      if (type === "focus" || type === "blur") return false;

      const hasHist = hasHistoryRef.current;
      const hasRec = hasRecentRef.current;
      const libShelfIdx = librariesShelfIndexRef.current;
      const recShelfIdx = recentShelfIndexRef.current;
      const shelfCount = (hasHist ? 1 : 0) + 1 + (hasRec ? 1 : 0);

      const shelfData = (shelf: number): readonly unknown[] => {
        if (hasHist && shelf === 0) return historyRef.current;
        if (shelf === libShelfIdx) return librariesRef.current;
        if (hasRec && shelf === recShelfIdx) return recentRef.current;
        return [];
      };

      if (type === "select") {
        // Select the same authoritative focus target used by D-pad movement.
        const selectShelf = activeShelfRef.current;
        const selectIdx = itemIndexRef.current;
        if (shelfData(selectShelf).length === 0) return false;
        saveContentFocus(FOCUS_KEY, { shelf: selectShelf, index: selectIdx });
        if (hasHist && selectShelf === 0) {
          const h = historyRef.current[selectIdx] as HistoryItem | undefined;
          if (h) {
            if (!ensureCanPlay()) return true;
            const tParam = h.position > 0 ? `?t=${Math.floor(h.position)}` : "";
            routerRef.current.push(`/player/${h.media_id}${tParam}`);
          }
        } else if (selectShelf === libShelfIdx) {
          const lib = librariesRef.current[selectIdx] as Library | undefined;
          if (lib) {
            useMusicPlayerStore.getState().setLyricsExpanded(false);
            setZoneRef.current("content");
            routerRef.current.push(`/library/${lib.id}`);
          }
        } else if (hasRec && selectShelf === recShelfIdx) {
          const item = recentRef.current[selectIdx] as MediaItem | undefined;
          if (item) routerRef.current.push(`/media/${item.id}`);
        }
        return true;
      }

      // Direction keys use immediate refs + that shelf's data for bounds.
      const shelf = activeShelfRef.current;
      const data = shelfData(shelf);
      if (data.length === 0) return false;

      if (type === "left") {
        if (itemIndexRef.current > 0) {
          const next = itemIndexRef.current - 1;
          itemIndexRef.current = next;
          setItemIndex(next);
        } else {
          setZoneRef.current("sidebar");
        }
        return true;
      }

      if (type === "right") {
        if (itemIndexRef.current < data.length - 1) {
          const next = itemIndexRef.current + 1;
          itemIndexRef.current = next;
          setItemIndex(next);
        }
        return true;
      }

      if (type === "up") {
        if (shelf > 0) {
          const nextShelf = shelf - 1;
          activeShelfRef.current = nextShelf;
          itemIndexRef.current = 0;
          setActiveShelf(nextShelf);
          setItemIndex(0);
        } else {
          exitContentUpRef.current();
        }
        return true;
      }

      if (type === "down") {
        if (shelf < shelfCount - 1) {
          const nextShelf = shelf + 1;
          activeShelfRef.current = nextShelf;
          itemIndexRef.current = 0;
          setActiveShelf(nextShelf);
          setItemIndex(0);
        } else {
          exitContentDownRef.current();
        }
        return true;
      }

      return false;
    }, []),
  );

  if (loading) return <LoadingState label={t("common.loading")} />;

  // Compute which item is highlighted on each shelf.
  const contentFocused = zone === "content";
  const histFocus = contentFocused && hasHistory && activeShelf === 0 ? itemIndex : -1;
  const libFocus = contentFocused && activeShelf === librariesShelfIndex ? itemIndex : -1;
  const recentFocus = contentFocused && hasRecent && activeShelf === recentShelfIndex ? itemIndex : -1;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>{appName}</Text>

        {hasHistory ? (
          <HorizontalShelf
            title={t("home.continue")}
            data={history}
            focusIndex={histFocus}
            keyExtractor={(h) => String(h.media_id)}
            empty={<Text style={styles.emptyHint}>{t("home.no_continue")}</Text>}
            renderItem={(h, _i, { selected }) => (
              <MediaCard
                tvSelected={selected}
                item={historyToMediaItem(h)}
                aspect="landscape"
                progress={h.duration > 0 ? (h.position / h.duration) * 100 : 0}
                onPress={() => {
                  saveContentFocus(FOCUS_KEY, { shelf: 0, index: history.findIndex((x) => x.media_id === h.media_id) });
                  if (!ensureCanPlay()) return;
                  const tParam = h.position > 0 ? `?t=${Math.floor(h.position)}` : "";
                  router.push(`/player/${h.media_id}${tParam}`);
                }}
              />
            )}
          />
        ) : (
          <Text style={styles.emptyHint}>{t("home.no_continue")}</Text>
        )}

        <HorizontalShelf
          title={t("home.libraries")}
          data={libraries}
          focusIndex={libFocus}
          keyExtractor={(lib) => String(lib.id)}
          renderItem={(lib, _i, { selected }) => (
            <LibraryCard
              library={lib}
              tvSelected={selected}
              onPress={() => {
                saveContentFocus(FOCUS_KEY, {
                  shelf: librariesShelfIndex,
                  index: libraries.findIndex((x) => x.id === lib.id),
                });
                useMusicPlayerStore.getState().setLyricsExpanded(false);
                setZone("content");
                router.push(`/library/${lib.id}`);
              }}
            />
          )}
        />

        {hasRecent ? (
          <HorizontalShelf
            title={t("home.recent")}
            data={recent}
            focusIndex={recentFocus}
            keyExtractor={(item) => String(item.id)}
            renderItem={(item, _i, { selected }) => (
              <MediaCard
                tvSelected={selected}
                item={item}
                onPress={() => {
                  saveContentFocus(FOCUS_KEY, {
                    shelf: recentShelfIndex,
                    index: recent.findIndex((x) => x.id === item.id),
                  });
                  router.push(`/media/${item.id}`);
                }}
              />
            )}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120, paddingTop: spacing.lg },
  brand: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});

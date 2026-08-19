import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { fetchLibraries, fetchMedia } from "@/api/client";
import type { Library, MediaItem } from "@/api/types";
import TvOnScreenKeyboard from "@/components/focus/TvOnScreenKeyboard";
import TvTextInput from "@/components/focus/TvTextInput";
import MediaCard from "@/components/media/MediaCard";
import { SIDEBAR_WIDTH } from "@/constants/layout";
import { colors, radius, spacing } from "@/constants/theme";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import { tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { t } from "@/i18n";
import { clearSearchHistory, loadSearchHistory, recordSearchHistory } from "@/lib/searchHistory";
import {
  indexMediaCatalog,
  indexedMediaMatches,
  isInitialSearchQuery,
  mergeMediaResults,
  type IndexedMediaTitle,
} from "@/lib/pinyinSearch";
import { ensureCanPlay } from "@/lib/playbackGate";
import { peekContentFocus, saveContentFocus } from "@/store/contentFocus";
import { useTvFocusStore } from "@/store/tvFocus";

const FOCUS_KEY = "search";

type ResultKind = "movies" | "series" | "music" | "photos" | "documents";
type ResultShelf = { kind: ResultKind; title: string; items: MediaItem[] };

const SEARCH_LIMIT = 100;
const PINYIN_LIBRARY_LIMIT = 2000;
const PINYIN_RESULT_LIMIT = 100;
const CATEGORY_RESULT_LIMIT = 60;
const DEBOUNCE_MS = 150;
const RESULT_COLUMNS = 5;
const RESULT_GAP = 14;

function resultKind(item: MediaItem, libraryTypes: ReadonlyMap<number, string>): ResultKind {
  if (item.file_type === "audio") return "music";
  if (item.file_type === "image") return "photos";
  if (item.file_type === "document") return "documents";
  const libraryType = (item.library_type || libraryTypes.get(item.library_id) || "").toLowerCase();
  return libraryType === "tv" || libraryType === "anime" ? "series" : "movies";
}

function mediaRoute(item: MediaItem): `/photo/${number}` | `/reader/${number}` | `/player/${number}` | `/media/${number}` {
  if (item.file_type === "image") return `/photo/${item.id}`;
  if (item.file_type === "document") return `/reader/${item.id}`;
  if (item.file_type === "audio") return `/player/${item.id}`;
  return `/media/${item.id}`;
}

export default function SearchScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const rowYRef = useRef<Record<number, number>>({ 0: 0 });
  const gridItemYRef = useRef<Record<string, number>>({});
  const pinyinCatalogRef = useRef<IndexedMediaTitle[] | null>(null);
  const pinyinCatalogPromiseRef = useRef<Promise<IndexedMediaTitle[]> | null>(null);

  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [libraryTypes, setLibraryTypes] = useState<Map<number, string>>(new Map());
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [focusRow, setFocusRow] = useState(0);
  const [focusColumns, setFocusColumns] = useState<Record<number, number>>({});

  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);

  const shelves = useMemo<ResultShelf[]>(() => {
    const grouped: Record<ResultKind, MediaItem[]> = {
      movies: [], series: [], music: [], photos: [], documents: [],
    };
    for (const item of items) grouped[resultKind(item, libraryTypes)].push(item);
    return (["movies", "series", "music", "photos", "documents"] as const)
      .map((kind) => ({ kind, title: t(`search.${kind}`), items: grouped[kind].slice(0, CATEGORY_RESULT_LIMIT) }))
      .filter((shelf) => shelf.items.length > 0);
  }, [items, libraryTypes]);

  const rows = useMemo(() => {
    const result: Array<{ type: "input" | "history" | "results"; items?: readonly unknown[]; columns?: number }> = [{ type: "input" }];
    if (history.length) result.push({ type: "history", items: [...history, "__clear_history__"] });
    for (const shelf of shelves) result.push({ type: "results", items: shelf.items, columns: RESULT_COLUMNS });
    return result;
  }, [history, shelves]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const historyRef = useRef(history);
  historyRef.current = history;
  const shelvesRef = useRef(shelves);
  shelvesRef.current = shelves;
  // Immediate focus — only updated by key handlers / restore, never clobbered from state.
  const focusRowRef = useRef(focusRow);
  const focusColumnsRef = useRef(focusColumns);
  const keyboardOpenRef = useRef(keyboardOpen);
  keyboardOpenRef.current = keyboardOpen;
  const routerRef = useRef(router);
  routerRef.current = router;

  const scrollToRow = useCallback((row: number) => {
    const y = rowYRef.current[row];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
  }, []);

  const moveToRow = useCallback((row: number) => {
    const clamped = Math.max(0, Math.min(rowsRef.current.length - 1, row));
    focusRowRef.current = clamped;
    setFocusRow(clamped);
    scrollToRow(clamped);
  }, [scrollToRow]);

  const scrollToGridItem = useCallback((row: number, index: number) => {
    const sectionY = rowYRef.current[row] ?? 0;
    const itemY = gridItemYRef.current[`${row}:${index}`] ?? 0;
    scrollRef.current?.scrollTo({
      y: Math.max(0, sectionY + itemY - spacing.xl * 2),
      animated: true,
    });
  }, []);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) {
      requestRef.current += 1;
      setItems([]);
      setSearchedQuery("");
      setLoading(false);
      setFailed(false);
      focusColumnsRef.current = {};
      setFocusColumns({});
      moveToRow(0);
      setZone("content");
      if (TV_NAV_ENABLED) setKeyboardOpen(true);
    }
  }, [moveToRow, setZone]);

  const chooseHistory = useCallback((term: string) => {
    setQuery(term);
    setFailed(false);
    setZone("content");
  }, [setZone]);

  const clearRecentSearches = useCallback(() => {
    void clearSearchHistory().catch(() => undefined);
    historyRef.current = [];
    setHistory([]);
    focusRowRef.current = 0;
    focusColumnsRef.current = {};
    setFocusRow(0);
    setFocusColumns({});
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const openItem = useCallback((item: MediaItem, focus?: { shelf: number; index: number }) => {
    if ((item.file_type === "audio" || item.file_type === "video") && mediaRoute(item).startsWith("/player")) {
      if (!ensureCanPlay()) return;
    }
    saveContentFocus(FOCUS_KEY, focus ?? {
      shelf: focusRowRef.current,
      index: focusColumnsRef.current[focusRowRef.current] ?? 0,
    });
    routerRef.current.push(mediaRoute(item));
  }, []);

  useFocusEffect(useCallback(() => {
    setZone("content");
    const saved = peekContentFocus(FOCUS_KEY);
    if (saved) {
      focusRowRef.current = saved.shelf ?? 0;
      focusColumnsRef.current = { ...focusColumnsRef.current, [saved.shelf ?? 0]: saved.index };
      moveToRow(saved.shelf ?? 0);
      setFocusColumns((prev) => ({ ...prev, [saved.shelf ?? 0]: saved.index }));
      return;
    }
    focusRowRef.current = 0;
    moveToRow(0);
  }, [moveToRow, setZone]));

  useEffect(() => {
    mountedRef.current = true;
    loadSearchHistory().then((value) => {
      if (mountedRef.current) setHistory(value);
    });
    fetchLibraries()
      .then((libraries: Library[]) => {
        if (mountedRef.current) setLibraryTypes(new Map(libraries.map((library) => [library.id, library.type])));
      })
      .catch(() => {
        if (mountedRef.current) setLibraryTypes(new Map());
      });
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  const loadPinyinCatalog = useCallback(async (): Promise<IndexedMediaTitle[]> => {
    if (pinyinCatalogRef.current) return pinyinCatalogRef.current;
    if (pinyinCatalogPromiseRef.current) return pinyinCatalogPromiseRef.current;
    const promise = (async () => {
      const libraries = await fetchLibraries();
      const batches = await Promise.all(
        libraries
          .filter((library) => library.enabled !== 0)
          .map((library) => fetchMedia(library.id, { limit: PINYIN_LIBRARY_LIMIT }).catch(() => [])),
      );
      const merged = mergeMediaResults([], batches.flat());
      const indexed = await indexMediaCatalog(merged);
      pinyinCatalogRef.current = indexed;
      return indexed;
    })().finally(() => {
      pinyinCatalogPromiseRef.current = null;
    });
    pinyinCatalogPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    // Typing must stay lightweight on TV. Search and pinyin indexing start only
    // after the user presses Done and the keyboard has closed.
    if (keyboardOpen) return;
    const term = query.trim();
    if (!term) return;
    const timer = setTimeout(() => {
      const request = ++requestRef.current;
      setLoading(true);
      setFailed(false);
      setSearchedQuery(term);
      recordSearchHistory(historyRef.current, term)
        .then((next) => {
          if (mountedRef.current) setHistory(next);
        })
        .catch(() => undefined);
      const serverSearch = fetchMedia(undefined, { q: term, limit: SEARCH_LIMIT });
      const pinyinSearch = isInitialSearchQuery(term)
        ? loadPinyinCatalog().then((catalog) =>
            catalog
              .filter((entry) => indexedMediaMatches(entry, term))
              .slice(0, PINYIN_RESULT_LIMIT)
              .map((entry) => entry.item),
          )
        : Promise.resolve([] as MediaItem[]);
      Promise.all([serverSearch, pinyinSearch])
        .then(([serverItems, pinyinItems]) => {
          if (!mountedRef.current || request !== requestRef.current) return;
          setItems(mergeMediaResults(serverItems, pinyinItems));
        })
        .catch(() => {
          if (!mountedRef.current || request !== requestRef.current) return;
          setItems([]);
          setFailed(true);
        })
        .finally(() => {
          if (mountedRef.current && request === requestRef.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyboardOpen, loadPinyinCatalog, query]);

  useEffect(() => {
    if (focusRowRef.current >= rows.length) moveToRow(rows.length - 1);
  }, [moveToRow, rows.length]);

  useMainContentNav(useCallback((evt: TvKeyEvent) => {
    if (keyboardOpenRef.current) return false;
    const type = tvNavigationEventType(evt.eventType);
    if (type === "focus" || type === "blur") return false;
    const currentRows = rowsRef.current;
    const row = focusRowRef.current;
    const current = currentRows[row];
    if (!current) return false;

    const itemCount = current.items?.length ?? 0;
    const columns = current.columns ?? Math.max(1, itemCount);
    const itemIndex = focusColumnsRef.current[row] ?? 0;
    const gridRow = Math.floor(itemIndex / columns);
    const gridColumn = itemIndex % columns;
    const moveWithinCurrent = (next: number) => {
      const clamped = Math.max(0, Math.min(itemCount - 1, next));
      focusColumnsRef.current = { ...focusColumnsRef.current, [row]: clamped };
      setFocusColumns(focusColumnsRef.current);
      if (current.type === "results") scrollToGridItem(row, clamped);
      else scrollToRow(row);
    };

    if (type === "up") {
      if (current.type === "results" && gridRow > 0) moveWithinCurrent(itemIndex - columns);
      else if (row > 0) moveToRow(row - 1);
      return true;
    }
    if (type === "down") {
      if (current.type === "results" && itemIndex + columns < itemCount) moveWithinCurrent(itemIndex + columns);
      else if (row < currentRows.length - 1) moveToRow(row + 1);
      return true;
    }
    if (type === "left") {
      if (row > 0 && itemIndex > 0 && (current.type !== "results" || gridColumn > 0)) moveWithinCurrent(itemIndex - 1);
      else setZone("sidebar");
      return true;
    }
    if (type === "right" && row > 0) {
      if (itemIndex < itemCount - 1 && (current.type !== "results" || gridColumn < columns - 1)) moveWithinCurrent(itemIndex + 1);
      return true;
    }
    if (type === "select") {
      const row = focusRowRef.current;
      const current = currentRows[row];
      if (!current) return false;
      if (current.type === "input") {
        requestRef.current += 1;
        setLoading(false);
        setKeyboardOpen(true);
      } else {
        const column = focusColumnsRef.current[row] ?? 0;
        if (current.type === "history") {
          if (column === historyRef.current.length) clearRecentSearches();
          else {
            const term = historyRef.current[column];
            if (term) chooseHistory(term);
          }
        } else {
          const historyOffset = historyRef.current.length ? 1 : 0;
          const shelf = shelvesRef.current[row - 1 - historyOffset];
          const item = shelf?.items[column];
          if (item) openItem(item, { shelf: row, index: column });
        }
      }
      return true;
    }
    return false;
  }, [chooseHistory, clearRecentSearches, moveToRow, openItem, scrollToGridItem, scrollToRow, setZone]));

  const onRowLayout = (row: number) => (event: LayoutChangeEvent) => {
    rowYRef.current[row] = event.nativeEvent.layout.y;
  };
  const contentFocused = zone === "content";
  let renderedRow = 1;
  const historyRow = history.length ? renderedRow++ : -1;

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View onLayout={onRowLayout(0)} style={styles.header}>
          <Text style={styles.title}>{t("search.title")}</Text>
          {TV_NAV_ENABLED ? (
            <Pressable
              focusable={false}
              onPress={undefined}
              style={[styles.tvInput, contentFocused && !keyboardOpen && focusRow === 0 && styles.selected]}
            >
              <Text style={query ? styles.inputText : styles.placeholder} numberOfLines={1}>
                {query || t("search.placeholder")}
              </Text>
              <Text style={styles.inputHint}>{t("search.open_keyboard")}</Text>
            </Pressable>
          ) : (
            <TvTextInput
              value={query}
              onChangeText={updateQuery}
              placeholder={t("search.placeholder")}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              autoFocus
            />
          )}
          {keyboardOpen && TV_NAV_ENABLED ? (
            <TvOnScreenKeyboard
              value={query}
              onChangeText={updateQuery}
              onDone={() => {
                // Close first; the search effect is intentionally gated on this.
                keyboardOpenRef.current = false;
                setKeyboardOpen(false);
                focusRowRef.current = 0;
                setFocusRow(0);
                scrollRef.current?.scrollTo({ y: 0, animated: false });
              }}
              preferredFocus
            />
          ) : null}
        </View>

        {!keyboardOpen && history.length > 0 ? (
          <View onLayout={onRowLayout(historyRow)} style={styles.historySection}>
            <Text style={styles.sectionTitle}>{t("search.history")}</Text>
            <View style={styles.historyRow}>
              {history.map((term, index) => {
                const selected = contentFocused && focusRow === historyRow && (focusColumns[historyRow] ?? 0) === index;
                return (
                  <Pressable
                    key={term}
                    focusable={false}
                    onPress={TV_NAV_ENABLED ? undefined : () => chooseHistory(term)}
                    style={[styles.historyChip, selected && styles.selected]}
                  >
                    <Text style={styles.historyText}>{term}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                focusable={false}
                onPress={TV_NAV_ENABLED ? undefined : clearRecentSearches}
                style={[
                  styles.historyChip,
                  styles.clearHistoryChip,
                  contentFocused && focusRow === historyRow && (focusColumns[historyRow] ?? 0) === history.length && styles.selected,
                ]}
              >
                <Text style={styles.clearHistoryText}>{t("search.clear_history")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!keyboardOpen && loading ? (
          <View style={styles.status}><ActivityIndicator color={colors.brand} /><Text style={styles.statusText}>{t("search.loading")}</Text></View>
        ) : null}
        {!keyboardOpen && !loading && failed ? <Text style={[styles.statusText, styles.status]}>{t("search.error")}</Text> : null}
        {!keyboardOpen && !loading && !failed && !searchedQuery ? <Text style={[styles.statusText, styles.status]}>{t("search.hint")}</Text> : null}
        {!keyboardOpen && !loading && !failed && searchedQuery && items.length === 0 ? (
          <Text style={[styles.statusText, styles.status]}>{t("search.empty", { query: searchedQuery })}</Text>
        ) : null}

        {!keyboardOpen ? shelves.map((shelf) => {
          const row = renderedRow++;
          const selectedIndex = contentFocused && focusRow === row ? (focusColumns[row] ?? 0) : -1;
          return (
            <View key={shelf.kind} onLayout={onRowLayout(row)} style={styles.resultSection}>
              <Text style={styles.sectionTitle}>{shelf.title}</Text>
              <View style={styles.resultGrid}>
                {shelf.items.map((item, index) => (
                  <View
                    key={item.id}
                    style={styles.resultCell}
                    onLayout={(event) => {
                      gridItemYRef.current[`${row}:${index}`] = event.nativeEvent.layout.y;
                    }}
                  >
                    <MediaCard
                      item={item}
                      layout="grid"
                      tvSelected={selectedIndex === index}
                      onPress={() => openItem(item)}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        }) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingTop: spacing.lg, paddingBottom: 100 },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 32, fontWeight: "700", marginBottom: spacing.lg },
  tvInput: {
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    justifyContent: "center",
  },
  selected: { borderColor: colors.brand, borderWidth: 3, backgroundColor: colors.surfaceElevated },
  inputText: { color: colors.text, fontSize: 22 },
  placeholder: { color: colors.textMuted, fontSize: 20 },
  inputHint: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 24, fontWeight: "700", marginBottom: spacing.md },
  historySection: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  historyRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  resultSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: RESULT_GAP },
  resultCell: { width: `${100 / RESULT_COLUMNS}%`, maxWidth: (1280 - SIDEBAR_WIDTH - spacing.lg * 2 - RESULT_GAP * (RESULT_COLUMNS - 1)) / RESULT_COLUMNS - 3 },
  historyChip: {
    minWidth: 150,
    maxWidth: 280,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  historyText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  clearHistoryChip: { borderColor: colors.accent },
  clearHistoryText: { color: colors.accent, fontSize: 18, fontWeight: "700" },
  status: { marginHorizontal: spacing.lg, marginBottom: spacing.xl, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  statusText: { color: colors.textSecondary, fontSize: 18 },
});

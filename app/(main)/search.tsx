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
import HorizontalShelf from "@/components/focus/HorizontalShelf";
import TvOnScreenKeyboard from "@/components/focus/TvOnScreenKeyboard";
import TvTextInput from "@/components/focus/TvTextInput";
import MediaCard from "@/components/media/MediaCard";
import { colors, radius, spacing } from "@/constants/theme";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import type { TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { t } from "@/i18n";
import { loadSearchHistory, recordSearchHistory } from "@/lib/searchHistory";
import { useTvFocusStore } from "@/store/tvFocus";

type ResultKind = "movies" | "series" | "music" | "photos" | "documents";
type ResultShelf = { kind: ResultKind; title: string; items: MediaItem[] };

const SEARCH_LIMIT = 100;
const DEBOUNCE_MS = 400;

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
      .map((kind) => ({ kind, title: t(`search.${kind}`), items: grouped[kind] }))
      .filter((shelf) => shelf.items.length > 0);
  }, [items, libraryTypes]);

  const rows = useMemo(() => {
    const result: Array<{ type: "input" | "history" | "results"; items?: readonly unknown[] }> = [{ type: "input" }];
    if (history.length) result.push({ type: "history", items: history });
    for (const shelf of shelves) result.push({ type: "results", items: shelf.items });
    return result;
  }, [history, shelves]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const historyRef = useRef(history);
  historyRef.current = history;
  const shelvesRef = useRef(shelves);
  shelvesRef.current = shelves;
  const focusRowRef = useRef(focusRow);
  focusRowRef.current = focusRow;
  const focusColumnsRef = useRef(focusColumns);
  focusColumnsRef.current = focusColumns;
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

  const openItem = useCallback((item: MediaItem) => {
    routerRef.current.push(mediaRoute(item));
  }, []);

  useFocusEffect(useCallback(() => {
    setZone("content");
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

  useEffect(() => {
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
      fetchMedia(undefined, { q: term, limit: SEARCH_LIMIT })
        .then((nextItems) => {
          if (!mountedRef.current || request !== requestRef.current) return;
          setItems(nextItems);
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
  }, [query]);

  useEffect(() => {
    if (focusRowRef.current >= rows.length) moveToRow(rows.length - 1);
  }, [moveToRow, rows.length]);

  useMainContentNav(useCallback((evt: TvKeyEvent) => {
    if (keyboardOpenRef.current) return false;
    const type = evt.eventType;
    if (type === "focus" || type === "blur") return false;
    const currentRows = rowsRef.current;
    const row = focusRowRef.current;
    const current = currentRows[row];
    if (!current) return false;

    if (type === "up") {
      if (row > 0) moveToRow(row - 1);
      return true;
    }
    if (type === "down") {
      if (row < currentRows.length - 1) moveToRow(row + 1);
      return true;
    }
    if (type === "left") {
      const column = focusColumnsRef.current[row] ?? 0;
      if (row > 0 && column > 0) {
        const next = column - 1;
        focusColumnsRef.current = { ...focusColumnsRef.current, [row]: next };
        setFocusColumns(focusColumnsRef.current);
      } else {
        setZone("sidebar");
      }
      return true;
    }
    if (type === "right" && row > 0) {
      const count = current.items?.length ?? 0;
      const column = focusColumnsRef.current[row] ?? 0;
      if (column < count - 1) {
        focusColumnsRef.current = { ...focusColumnsRef.current, [row]: column + 1 };
        setFocusColumns(focusColumnsRef.current);
      }
      return true;
    }
    if (type === "select") {
      if (current.type === "input") {
        setKeyboardOpen(true);
      } else {
        const column = focusColumnsRef.current[row] ?? 0;
        if (current.type === "history") {
          const term = historyRef.current[column];
          if (term) chooseHistory(term);
        } else {
          const historyOffset = historyRef.current.length ? 1 : 0;
          const shelf = shelvesRef.current[row - 1 - historyOffset];
          const item = shelf?.items[column];
          if (item) openItem(item);
        }
      }
      return true;
    }
    return false;
  }, [chooseHistory, moveToRow, openItem, setZone]));

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
              onPress={() => setKeyboardOpen(true)}
              style={[styles.tvInput, contentFocused && focusRow === 0 && styles.selected]}
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
                setKeyboardOpen(false);
                moveToRow(0);
              }}
              preferredFocus
            />
          ) : null}
        </View>

        {!keyboardOpen && history.length > 0 ? (
          <View onLayout={onRowLayout(historyRow)}>
            <HorizontalShelf
              title={t("search.history")}
              data={history}
              focusIndex={contentFocused && focusRow === historyRow ? (focusColumns[historyRow] ?? 0) : -1}
              keyExtractor={(term) => term}
              renderItem={(term, _index, { selected }) => (
                <Pressable
                  focusable={!TV_NAV_ENABLED}
                  onPress={() => chooseHistory(term)}
                  style={[styles.historyChip, selected && styles.selected]}
                >
                  <Text style={styles.historyText}>{term}</Text>
                </Pressable>
              )}
            />
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
          return (
            <View key={shelf.kind} onLayout={onRowLayout(row)}>
              <HorizontalShelf
                title={shelf.title}
                data={shelf.items}
                focusIndex={contentFocused && focusRow === row ? (focusColumns[row] ?? 0) : -1}
                keyExtractor={(item) => String(item.id)}
                renderItem={(item, _index, { selected }) => (
                  <MediaCard item={item} tvSelected={selected} onPress={() => openItem(item)} />
                )}
              />
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
  status: { marginHorizontal: spacing.lg, marginBottom: spacing.xl, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  statusText: { color: colors.textSecondary, fontSize: 18 },
});

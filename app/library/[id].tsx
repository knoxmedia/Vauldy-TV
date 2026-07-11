import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchLibraries, fetchLibrarySeries, fetchLibraryTracks, fetchMedia } from "@/api/client";
import type { Library, MediaItem, MusicTrackRow, SeriesSummary } from "@/api/types";
import EmptyState from "@/components/EmptyState";
import TvBackButton, { useTvBackHandler } from "@/components/focus/TvBackButton";
import LoadingState, { Screen } from "@/components/LoadingState";
import MediaCard from "@/components/media/MediaCard";
import MusicTrackList from "@/components/music/MusicTrackList";
import SeriesCard from "@/components/series/SeriesCard";
import { colors, spacing } from "@/constants/theme";
import { SIDEBAR_WIDTH } from "@/constants/layout";
import { useTvRemoteNav } from "@/hooks/useTvRemoteNav";
import { isMusicLibraryType, isPhotoLibraryType, isTVLibraryType, libraryFileType } from "@/lib/library";
import { useTvFocusStore } from "@/store/tvFocus";
import { t } from "@/i18n";

const GRID_COLUMNS = 6;
const GRID_GAP = 14;
const GRID_ROW_GAP = 16;

function libraryGridAspect(library: Library | null): "poster" | "landscape" {
  if (library && isPhotoLibraryType(library.type)) return "landscape";
  return "poster";
}

export default function LibraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const libraryId = Number(id);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [library, setLibrary] = useState<Library | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [seriesItems, setSeriesItems] = useState<SeriesSummary[]>([]);
  const [tracks, setTracks] = useState<MusicTrackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isMusicLibrary = isMusicLibraryType(library?.type || "");
  const isTVLibrary = isTVLibraryType(library?.type || "");

  const goBack = useCallback(() => router.back(), [router]);
  useTvBackHandler(goBack);
  const setZone = useTvFocusStore((s) => s.setZone);

  useFocusEffect(
    useCallback(() => {
      setZone("content");
    }, [setZone]),
  );

  const gridLayout = useMemo(() => {
    const horizontalPadding = spacing.lg * 2;
    const availableWidth = Math.max(0, screenWidth - SIDEBAR_WIDTH - horizontalPadding);
    const itemWidth = Math.floor((availableWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
    return { itemWidth };
  }, [screenWidth]);

  const gridAspect = libraryGridAspect(library);
  const listRef = useRef<FlatList<(MediaItem | SeriesSummary)[]>>(null);

  const scrollToItem = useCallback((index: number) => {
    const row = Math.floor(index / GRID_COLUMNS);
    listRef.current?.scrollToIndex({ index: row, animated: true, viewPosition: 0.35 });
  }, []);

  const openItem = useCallback((item: MediaItem) => {
    if (item.file_type === "image") {
      router.push(`/photo/${item.id}`);
      return;
    }
    router.push(`/media/${item.id}`);
  }, [router]);

  const openSeries = useCallback((series: SeriesSummary) => {
    router.push(`/series/${series.id}`);
  }, [router]);

  const { index: focusIndex } = useTvRemoteNav({
    mode: "grid",
    columns: GRID_COLUMNS,
    count: isMusicLibrary ? 0 : isTVLibrary ? seriesItems.length : items.length,
    enabled: !isMusicLibrary,
    onSelect: (i) => {
      if (isTVLibrary) {
        const series = seriesItems[i];
        if (series) openSeries(series);
        return;
      }
      const item = items[i];
      if (item) openItem(item);
    },
    onIndexChange: scrollToItem,
    onExitUp: () => useTvFocusStore.getState().exitContentUp(),
    onExitDown: () => useTvFocusStore.getState().exitContentDown(),
  });

  const gridRows = useMemo(() => {
    const source = isTVLibrary ? seriesItems : items;
    const rows: (MediaItem | SeriesSummary)[][] = [];
    for (let i = 0; i < source.length; i += GRID_COLUMNS) {
      rows.push(source.slice(i, i + GRID_COLUMNS));
    }
    return rows;
  }, [isTVLibrary, seriesItems, items]);

  const load = useCallback(async () => {
    const libs = await fetchLibraries();
    const lib = libs.find((l) => l.id === libraryId) || null;
    setLibrary(lib);
    if (lib && isMusicLibraryType(lib.type)) {
      const rows = await fetchLibraryTracks(libraryId);
      setTracks(rows);
      setItems([]);
      setSeriesItems([]);
      return;
    }
    if (lib && isTVLibraryType(lib.type)) {
      const series = await fetchLibrarySeries(libraryId);
      setSeriesItems(series);
      setItems([]);
      setTracks([]);
      return;
    }
    const fileType = lib ? libraryFileType(lib.type) : undefined;
    const sort = lib && isPhotoLibraryType(lib.type) ? "taken_desc" : "created_desc";
    const media = await fetchMedia(libraryId, {
      file_type: fileType,
      sort,
      limit: isPhotoLibraryType(lib?.type || "") ? 500 : 200,
    });
    setItems(media);
    setTracks([]);
    setSeriesItems([]);
  }, [libraryId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {
        setItems([]);
        setTracks([]);
        setSeriesItems([]);
      })
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) return <LoadingState />;

  const headerCount = isMusicLibrary
    ? tracks.length
    : isTVLibrary
      ? seriesItems.length
      : (library?.media_count ?? items.length);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{library?.name || t("browse.title")}</Text>
          {library ? (
            <Text style={styles.subtitle}>
              {t("library.media_count", { count: headerCount })}
            </Text>
          ) : null}
        </View>
        <TvBackButton onPress={goBack} />
      </View>
      {isMusicLibrary ? (
        tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <MusicTrackList tracks={tracks} />
        )
      ) : (
        <FlatList
          ref={listRef}
          data={gridRows}
          keyExtractor={(_, rowIndex) => `row-${rowIndex}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            isTVLibrary ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t("series.empty")}</Text>
              </View>
            ) : (
              <EmptyState />
            )
          }
          removeClippedSubviews={false}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
          renderItem={({ item: row, index: rowIndex }) => (
            <View style={styles.row}>
              {row.map((entry, colIndex) => {
                const itemIndex = rowIndex * GRID_COLUMNS + colIndex;
                return (
                  <View key={entry.id} style={[styles.cell, { width: gridLayout.itemWidth, marginRight: colIndex < row.length - 1 ? GRID_GAP : 0 }]}>
                    {isTVLibrary ? (
                      <SeriesCard
                        series={entry as SeriesSummary}
                        tvSelected={focusIndex >= 0 && focusIndex === itemIndex}
                        onPress={() => openSeries(entry as SeriesSummary)}
                      />
                    ) : (
                      <MediaCard
                        item={entry as MediaItem}
                        layout="grid"
                        aspect={gridAspect}
                        tvSelected={focusIndex >= 0 && focusIndex === itemIndex}
                        onPress={() => openItem(entry as MediaItem)}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, marginTop: 8, fontSize: 16 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  row: { flexDirection: "row", marginBottom: GRID_ROW_GAP },
  cell: { flexShrink: 0, paddingVertical: 2 },
  empty: { padding: 48, alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 20 },
});

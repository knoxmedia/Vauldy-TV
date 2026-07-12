import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { fetchFavorites } from "@/api/client";
import type { MediaItem } from "@/api/types";
import EmptyState from "@/components/EmptyState";
import LoadingState, { Screen } from "@/components/LoadingState";
import MediaCard from "@/components/media/MediaCard";
import { colors, spacing } from "@/constants/theme";
import { SIDEBAR_WIDTH } from "@/constants/layout";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import type { TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { useTvFocusStore } from "@/store/tvFocus";
import { t } from "@/i18n";

const GRID_COLUMNS = 4;
const GRID_GAP = 16;
const GRID_ROW_GAP = 16;

export default function FavoritesScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList<MediaItem[]>>(null);

  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const exitContentUp = useTvFocusStore((s) => s.exitContentUp);
  const exitContentDown = useTvFocusStore((s) => s.exitContentDown);

  const [focusIndex, setFocusIndex] = useState(0);

  const itemWidth = useMemo(() => {
    const horizontalPadding = spacing.lg * 2;
    const availableWidth = Math.max(0, screenWidth - SIDEBAR_WIDTH - horizontalPadding);
    return Math.floor((availableWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  }, [screenWidth]);

  const gridRows = useMemo(() => {
    const rows: MediaItem[][] = [];
    for (let i = 0; i < items.length; i += GRID_COLUMNS) {
      rows.push(items.slice(i, i + GRID_COLUMNS));
    }
    return rows;
  }, [items]);

  // Refs for stable handler access.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;
  const routerRef = useRef(router);
  routerRef.current = router;
  const setZoneRef = useRef(setZone);
  setZoneRef.current = setZone;
  const exitContentUpRef = useRef(exitContentUp);
  exitContentUpRef.current = exitContentUp;
  const exitContentDownRef = useRef(exitContentDown);
  exitContentDownRef.current = exitContentDown;
  const listRefRef = useRef(listRef);
  listRefRef.current = listRef;

  // Render-confirmed ref — updated ONLY by React render.
  const focusIndexConfirmed = useRef(focusIndex);
  focusIndexConfirmed.current = focusIndex;

  const scrollToItem = useCallback((index: number) => {
    const row = Math.floor(index / GRID_COLUMNS);
    listRefRef.current.current?.scrollToIndex({ index: row, animated: true, viewPosition: 0.35 });
  }, []);

  useEffect(() => {
    fetchFavorites()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useMainContentNav(
    useCallback((evt: TvKeyEvent) => {
      const type = evt.eventType;
      if (type === "focus" || type === "blur") return false;

      const count = itemsRef.current.length;
      if (count === 0) return false;

      const cur = focusIndexRef.current;
      const columns = GRID_COLUMNS;
      const row = Math.floor(cur / columns);
      const col = cur % columns;
      const maxRow = Math.floor((count - 1) / columns);

      if (type === "select") {
        const item = itemsRef.current[focusIndexConfirmed.current];
        if (item) routerRef.current.push(`/media/${item.id}`);
        return true;
      }
      if (type === "left") {
        if (col > 0) {
          const next = cur - 1;
          focusIndexRef.current = next;
          setFocusIndex(next);
          scrollToItem(next);
        } else {
          setZoneRef.current("sidebar");
        }
        return true;
      }
      if (type === "right") {
        if (col < columns - 1 && cur + 1 < count) {
          const next = cur + 1;
          focusIndexRef.current = next;
          setFocusIndex(next);
          scrollToItem(next);
        }
        return true;
      }
      if (type === "up") {
        if (row > 0) {
          const next = cur - columns;
          focusIndexRef.current = next;
          setFocusIndex(next);
          scrollToItem(next);
        } else {
          exitContentUpRef.current();
        }
        return true;
      }
      if (type === "down") {
        if (row < maxRow && cur + columns < count) {
          const next = cur + columns;
          focusIndexRef.current = next;
          setFocusIndex(next);
          scrollToItem(next);
        } else {
          exitContentDownRef.current();
        }
        return true;
      }
      return false;
    }, [scrollToItem]),
  );

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <Text style={styles.title}>{t("favorites.title")}</Text>
      <FlatList
        ref={listRef}
        data={gridRows}
        keyExtractor={(_, rowIndex) => `row-${rowIndex}`}
        extraData={focusIndex}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState />}
        removeClippedSubviews={false}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
        }}
        renderItem={({ item: row, index: rowIndex }) => (
          <View style={styles.row}>
            {row.map((item, colIndex) => {
              const itemIndex = rowIndex * GRID_COLUMNS + colIndex;
              return (
                <View
                  key={item.id}
                  style={[styles.cell, { width: itemWidth, marginRight: colIndex < row.length - 1 ? GRID_GAP : 0 }]}
                >
                  <MediaCard
                    item={item}
                    layout="grid"
                    tvSelected={zone === "content" && focusIndex >= 0 && focusIndex === itemIndex}
                    onPress={() => router.push(`/media/${item.id}`)}
                  />
                </View>
              );
            })}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 32, fontWeight: "700", padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  row: { flexDirection: "row", marginBottom: GRID_ROW_GAP },
  cell: { flexShrink: 0 },
});

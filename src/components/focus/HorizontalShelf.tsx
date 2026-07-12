import { useCallback, useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { colors, spacing } from "@/constants/theme";

export type ShelfRenderCtx = {
  selected: boolean;
};

type Props<T> = {
  title: string;
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number, ctx: ShelfRenderCtx) => React.ReactNode;
  empty?: React.ReactNode;
  /** External focus index (-1 = no focus). */
  focusIndex?: number;
};

export default function HorizontalShelf<T>({
  title,
  data,
  keyExtractor,
  renderItem,
  empty,
  focusIndex = -1,
}: Props<T>) {
  const listRef = useRef<FlatList<T>>(null);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= data.length) return;
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    },
    [data.length],
  );

  // Scroll when focus changes.
  useEffect(() => {
    if (focusIndex >= 0) scrollToIndex(focusIndex);
  }, [focusIndex, scrollToIndex]);

  const renderListItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => (
      <View style={styles.item}>
        {renderItem(item, index, {
          selected: focusIndex >= 0 && focusIndex === index,
        })}
      </View>
    ),
    [focusIndex, renderItem],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {data.length === 0 && empty ? (
        <View style={styles.empty}>{empty}</View>
      ) : (
        <FlatList
          ref={listRef}
          horizontal
          data={data as T[]}
          keyExtractor={keyExtractor}
          renderItem={renderListItem}
          extraData={focusIndex}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          removeClippedSubviews={false}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => scrollToIndex(info.index), 80);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  row: { paddingHorizontal: spacing.lg },
  item: { flexShrink: 0, marginRight: 16 },
  empty: { paddingHorizontal: spacing.lg },
});

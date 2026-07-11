import { useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import type { EpisodeRow } from "@/api/types";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { formatDuration } from "@/lib/mediaUrl";
import { episodeIsCompleted, pickPrimaryEpisodeMediaId } from "@/lib/seriesPlayback";
import { useTvRemoteNav } from "@/hooks/useTvRemoteNav";

type Props = {
  episodes: EpisodeRow[];
  enabled?: boolean;
  onExitUp?: () => void;
  onExitLeft?: () => void;
  onPressEpisode: (ep: EpisodeRow, index: number) => void;
};

export default function EpisodeList({
  episodes,
  enabled = true,
  onExitUp,
  onExitLeft,
  onPressEpisode,
}: Props) {
  const listRef = useRef<FlatList<EpisodeRow>>(null);

  const sorted = useMemo(
    () => [...episodes].sort((a, b) => a.episode_num - b.episode_num),
    [episodes],
  );

  const scrollToIndex = useCallback((index: number) => {
    if (sorted.length === 0) return;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.45 });
  }, [sorted.length]);

  const { index: focusIndex, setIndex } = useTvRemoteNav({
    mode: "vertical",
    count: sorted.length,
    enabled,
    onSelect: (i) => {
      const ep = sorted[i];
      if (!ep) return;
      if (pickPrimaryEpisodeMediaId(ep) == null) return;
      onPressEpisode(ep, i);
    },
    onIndexChange: scrollToIndex,
    onExitUp,
    onExitLeft,
  });

  useEffect(() => {
    setIndex(0);
  }, [sorted, setIndex]);

  const renderRow = ({ item, index }: ListRenderItemInfo<EpisodeRow>) => {
    const selected = focusIndex >= 0 && focusIndex === index;
    const playable = pickPrimaryEpisodeMediaId(item) != null;
    const completed = episodeIsCompleted(item);
    const duration = item.duration ? formatDuration(item.duration) : "—";
    const title = item.title?.trim() || t("series.episode_n", { n: item.episode_num });

    return (
      <Pressable
        focusable={false}
        disabled={!playable}
        onPress={() => {
          if (!playable) return;
          onPressEpisode(item, index);
        }}
        style={[
          styles.row,
          selected && styles.rowSelected,
          !playable && styles.rowDisabled,
        ]}
      >
        <Text style={[styles.epNum, !playable && styles.textMuted]}>E{item.episode_num}</Text>
        <Text
          style={[styles.title, !playable && styles.textMuted]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {completed ? (
          <Text style={styles.badge}>{t("series.completed")}</Text>
        ) : null}
        <Text style={[styles.duration, !playable && styles.textMuted]} numberOfLines={1}>
          {duration}
        </Text>
      </Pressable>
    );
  };

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t("series.no_episodes")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={sorted}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      removeClippedSubviews={false}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
      }}
      renderItem={renderRow}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 120,
    paddingHorizontal: spacing.md,
  },
  empty: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "transparent",
    gap: 12,
  },
  rowSelected: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: colors.brand,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  epNum: {
    width: 48,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
  },
  badge: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  duration: {
    width: 72,
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: "right",
  },
  textMuted: {
    color: colors.textMuted,
  },
});

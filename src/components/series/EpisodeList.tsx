import { useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { EpisodeMediaVersion, EpisodeRow } from "@/api/types";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { formatDuration, normalizeListPosterUrl, withAccessToken } from "@/lib/mediaUrl";
import { episodeIsCompleted, pickPrimaryEpisodeMediaId } from "@/lib/seriesPlayback";
import { TV_NAV_ENABLED, useTvRemoteNav } from "@/hooks/useTvRemoteNav";

type Props = {
  episodes: EpisodeRow[];
  completedMediaIds?: Set<number>;
  enabled?: boolean;
  /** Bump on season switch to reset focus; keep stable when silently refreshing. */
  resetIndexKey?: string | number;
  onExitUp?: () => void;
  onExitLeft?: () => void;
  onPressEpisode: (ep: EpisodeRow, index: number) => void;
};

function episodePosterUrl(ep: EpisodeRow): string {
  const versions = ep.versions ?? [];
  const sorted = [...versions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const v = sorted[0];
  const raw = v?.poster_url;
  if (!raw) return "";
  return withAccessToken(normalizeListPosterUrl(raw));
}

function primaryEpisodeVersion(ep: EpisodeRow, mediaId: number | null): EpisodeMediaVersion | null {
  const versions = ep.versions ?? [];
  if (versions.length === 0) return null;
  return versions.find((v) => v.media_id === mediaId) ?? versions[0] ?? null;
}

export default function EpisodeList({
  episodes,
  completedMediaIds,
  enabled = true,
  resetIndexKey,
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

  // Reset only when the season changes. Silent refreshes (same key) keep the
  // remote focus where the user left it; useTvRemoteNav clamps on count change.
  useEffect(() => {
    setIndex(0);
  }, [resetIndexKey, setIndex]);

  const renderRow = ({ item, index }: ListRenderItemInfo<EpisodeRow>) => {
    const selected = focusIndex >= 0 && focusIndex === index;
    const primaryMediaId = pickPrimaryEpisodeMediaId(item);
    const playable = primaryMediaId != null;
    const primaryVersion = primaryEpisodeVersion(item, primaryMediaId);
    // History API excludes completed rows, so don't let an (always-present)
    // completedMediaIds prop mask the version-level flag — merge both sources.
    const completed =
      (primaryMediaId != null && completedMediaIds?.has(primaryMediaId) === true) ||
      episodeIsCompleted(item);
    // episode.duration is never backfilled server-side (stays 0) — fall back
    // to the linked media duration carried in versions[].
    const durationSec = item.duration && item.duration > 0 ? item.duration : primaryVersion?.duration ?? 0;
    const duration = durationSec > 0 ? formatDuration(durationSec) : "—";
    const title = item.title?.trim() || t("series.episode_n", { n: item.episode_num });
    const posterUri = episodePosterUrl(item);
    const showPoster = Boolean(posterUri);

    return (
      <Pressable
        focusable={false}
        disabled={!playable}
        onPress={TV_NAV_ENABLED ? undefined : () => {
          if (!playable) return;
          onPressEpisode(item, index);
        }}
        style={[
          styles.row,
          selected && styles.rowSelected,
          !playable && styles.rowDisabled,
        ]}
      >
        {/* Episode poster thumbnail */}
        <View style={styles.posterWrap}>
          {showPoster ? (
            <Image
              source={{ uri: posterUri }}
              style={styles.posterImg}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.posterImg, styles.posterPlaceholder]}>
              <Ionicons name="film-outline" size={18} color={colors.textMuted} />
            </View>
          )}
        </View>
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
    paddingVertical: 12,
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
  posterWrap: {
    width: 80,
    height: 45,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  posterImg: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
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

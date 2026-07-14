import { useMemo, useRef, useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from "react-native";
import type { MusicTrackRow } from "@/api/types";
import NowPlayingIndicator from "@/components/music/NowPlayingIndicator";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { formatDuration } from "@/lib/mediaUrl";
import { trackRowsToMusicTracks } from "@/lib/musicQueue";
import { TV_NAV_ENABLED, useTvRemoteNav } from "@/hooks/useTvRemoteNav";
import { useMusicPlayerStore } from "@/store/musicPlayer";
import { useTvFocusStore } from "@/store/tvFocus";

type Props = {
  tracks: MusicTrackRow[];
  onExitLeft?: () => void;
};

export default function MusicTrackList({ tracks, onExitLeft }: Props) {
  const listRef = useRef<FlatList<MusicTrackRow>>(null);
  const currentMediaId = useMusicPlayerStore((s) => s.mediaId);
  const playing = useMusicPlayerStore((s) => s.playing);
  const playTrack = useMusicPlayerStore((s) => s.playTrack);
  const exitContentUp = useTvFocusStore((s) => s.exitContentUp);
  const exitContentDown = useTvFocusStore((s) => s.exitContentDown);
  const zone = useTvFocusStore((s) => s.zone);

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-CN")),
    [tracks],
  );
  const queue = useMemo(() => trackRowsToMusicTracks(sortedTracks), [sortedTracks]);
  const sortedRef = useRef(sortedTracks);
  sortedRef.current = sortedTracks;

  const playAt = useCallback(
    (mediaId: number) => {
      const index = queue.findIndex((track) => track.mediaId === mediaId);
      if (index < 0) return;
      playTrack(queue[index]!, queue, index);
    },
    [playTrack, queue],
  );

  const scrollToIndex = useCallback((index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.45 });
  }, []);

  const { index: focusIndex } = useTvRemoteNav({
    mode: "vertical",
    count: sortedTracks.length,
    enabled: zone === "content",
    onSelect: (i) => {
      const row = sortedRef.current[i];
      if (row) playAt(row.media_id);
    },
    onIndexChange: scrollToIndex,
    onExitLeft,
    onExitUp: () => {
      exitContentUp();
    },
    onExitDown: () => {
      exitContentDown();
    },
  });

  const header = (
    <View style={styles.headerRow} focusable={false}>
      <Text style={[styles.headerText, styles.colIndex]}>#</Text>
      <Text style={[styles.headerText, styles.colTitle]}>{t("music.col_title")}</Text>
      <Text style={[styles.headerText, styles.colAlbumArtist]}>{t("music.col_album_artist")}</Text>
      <Text style={[styles.headerText, styles.colArtist]}>{t("music.col_artist")}</Text>
      <Text style={[styles.headerText, styles.colAlbum]}>{t("music.col_album")}</Text>
      <Text style={[styles.headerText, styles.colDuration]}>{t("music.col_duration")}</Text>
    </View>
  );

  const renderRow = ({ item, index }: ListRenderItemInfo<MusicTrackRow>) => {
    const isCurrent = currentMediaId === item.media_id;
    const selected = focusIndex >= 0 && focusIndex === index;
    const albumArtist = item.album_artist || "Various Artists";
    const artist = item.artist || albumArtist;
    const album = item.album_title || "";
    const duration = item.duration ? formatDuration(item.duration) : "—";

    return (
      <Pressable
        focusable={false}
        onPress={TV_NAV_ENABLED ? undefined : () => playAt(item.media_id)}
        style={[styles.row, isCurrent && styles.rowActive, selected && styles.rowSelected]}
      >
        <View style={styles.colIndex}>
          {isCurrent ? (
            <NowPlayingIndicator playing={playing} />
          ) : (
            <Text style={styles.indexText}>{item.track_number || index + 1}</Text>
          )}
        </View>
        <Text style={[styles.cell, styles.colTitle, isCurrent && styles.cellActive]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cell, styles.colAlbumArtist]} numberOfLines={1}>
          {albumArtist}
        </Text>
        <Text style={[styles.cell, styles.colArtist]} numberOfLines={1}>
          {artist}
        </Text>
        <Text style={[styles.cell, styles.colAlbum]} numberOfLines={1}>
          {album}
        </Text>
        <Text style={[styles.cell, styles.colDuration, styles.durationText]} numberOfLines={1}>
          {duration}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={sortedTracks}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      removeClippedSubviews={false}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
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
  },
  rowActive: {
    backgroundColor: "rgba(229,160,13,0.08)",
  },
  rowSelected: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: colors.brand,
  },
  colIndex: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  colTitle: { flex: 2.2, minWidth: 0, marginRight: 12 },
  colAlbumArtist: { flex: 1.4, minWidth: 0, marginRight: 12 },
  colArtist: { flex: 1.4, minWidth: 0, marginRight: 12 },
  colAlbum: { flex: 1.2, minWidth: 0, marginRight: 12 },
  colDuration: { width: 72, minWidth: 72 },
  cell: {
    color: colors.text,
    fontSize: 16,
  },
  cellActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  indexText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  durationText: {
    color: colors.textSecondary,
    textAlign: "right",
  },
});

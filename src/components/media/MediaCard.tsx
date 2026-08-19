import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import FocusablePressable from "@/components/focus/FocusablePressable";
import { colors, radius } from "@/constants/theme";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { formatDuration, mediaPosterSrc, mediaReleaseYear } from "@/lib/mediaUrl";
import type { MediaItem } from "@/api/types";

type Props = {
  item: MediaItem;
  onPress: () => void;
  aspect?: "poster" | "landscape";
  layout?: "shelf" | "grid";
  progress?: number;
  preferredFocus?: boolean;
  onPosterFocus?: () => void;
  /** Programmatic TV selection highlight (Android TV remote nav). */
  tvSelected?: boolean;
};

function placeholderIconName(fileType: string): keyof typeof Ionicons.glyphMap {
  if (fileType === "audio") return "musical-notes-outline";
  if (fileType === "image") return "image-outline";
  if (fileType === "document") return "document-text-outline";
  return "film-outline";
}

export default function MediaCard({
  item,
  onPress,
  aspect = "poster",
  layout = "shelf",
  progress,
  preferredFocus,
  onPosterFocus,
  tvSelected,
}: Props) {
  const poster = mediaPosterSrc(item);
  const year = mediaReleaseYear(item);
  const landscape = aspect === "landscape";
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [poster, item.id]);

  const showPoster = Boolean(poster) && !imageFailed;
  const placeholderIcon = placeholderIconName(item.file_type);
  const useRemoteNav = TV_NAV_ENABLED && tvSelected !== undefined;

  const posterBody = (
    <View style={[styles.posterWrap, landscape ? styles.posterLandscape : undefined]}>
      {showPoster ? (
        <Image
          source={{ uri: poster }}
          style={styles.poster}
          contentFit="cover"
          transition={200}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.poster, styles.placeholder]}>
          <Ionicons name={placeholderIcon} size={36} color={colors.textMuted} />
        </View>
      )}
      {item.file_type === "video" && item.duration > 0 ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}
      {typeof progress === "number" && progress > 0 ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${Math.min(progress, 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[layout === "grid" ? styles.cardGrid : landscape ? styles.cardShelfLandscape : styles.cardShelfPoster]}>
      {useRemoteNav ? (
        <Pressable focusable={false} style={styles.posterFocus}>
          {tvSelected ? <View style={[styles.focusRing, styles.posterFocusRing]} pointerEvents="none" /> : null}
          {posterBody}
        </Pressable>
      ) : (
        <FocusablePressable
          onPress={onPress}
          preferredFocus={preferredFocus}
          onFocus={onPosterFocus}
          style={styles.posterFocus}
          focusedStyle={styles.posterFocused}
          focusRingStyle={styles.posterFocusRing}
        >
          {posterBody}
        </FocusablePressable>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {item.title || item.file_path}
      </Text>
      {year ? <Text style={styles.meta}>{year}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardGrid: { width: "100%", alignSelf: "stretch" },
  cardShelfPoster: { width: 160 },
  cardShelfLandscape: { width: 260 },
  posterFocus: { width: "100%" },
  posterFocused: {},
  posterFocusRing: { borderRadius: radius.lg },
  focusRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    zIndex: 2,
  },
  posterWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterLandscape: { aspectRatio: 16 / 9 },
  poster: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  durationBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: colors.overlay,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressBar: { height: "100%", backgroundColor: colors.accent },
  title: { color: colors.text, fontSize: 16, marginTop: 10, lineHeight: 22 },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
});

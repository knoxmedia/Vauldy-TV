import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import FocusablePressable from "@/components/focus/FocusablePressable";
import { colors, radius } from "@/constants/theme";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { normalizeListPosterUrl, withAccessToken } from "@/lib/mediaUrl";
import type { SeriesSummary } from "@/api/types";

type Props = {
  series: SeriesSummary;
  onPress: () => void;
  /** Programmatic TV selection highlight (Android TV remote nav). */
  tvSelected?: boolean;
};

export default function SeriesCard({ series, onPress, tvSelected }: Props) {
  const posterRaw = series.poster_url || series.poster || "";
  const poster = posterRaw ? withAccessToken(normalizeListPosterUrl(posterRaw)) : "";
  const year = series.year;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [poster, series.id]);

  const showPoster = Boolean(poster) && !imageFailed;
  const useRemoteNav = TV_NAV_ENABLED && tvSelected !== undefined;

  const posterBody = (
    <View style={styles.posterWrap}>
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
          <Ionicons name="film-outline" size={36} color={colors.textMuted} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.cardGrid}>
      {useRemoteNav ? (
        <Pressable focusable={false} style={styles.posterFocus}>
          {tvSelected ? <View style={[styles.focusRing, styles.posterFocusRing]} pointerEvents="none" /> : null}
          {posterBody}
        </Pressable>
      ) : (
        <FocusablePressable
          onPress={onPress}
          style={styles.posterFocus}
          focusedStyle={styles.posterFocused}
          focusRingStyle={styles.posterFocusRing}
        >
          {posterBody}
        </FocusablePressable>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {series.title}
      </Text>
      {year ? <Text style={styles.meta}>{year}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardGrid: { width: "100%", alignSelf: "stretch" },
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
  poster: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 16, marginTop: 10, lineHeight: 22 },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
});

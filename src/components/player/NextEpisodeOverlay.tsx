import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";

type Props = {
  visible: boolean;
  secondsLeft: number;
  episodeTitle?: string;
  episodeNum?: number;
  posterUrl?: string;
  onPlayNow: () => void;
  onCancel: () => void;
  /** 0 = play now, 1 = cancel */
  focusIndex?: number;
};

export default function NextEpisodeOverlay({
  visible,
  secondsLeft,
  episodeTitle,
  episodeNum,
  posterUrl,
  onPlayNow,
  onCancel,
  focusIndex = 0,
}: Props) {
  if (!visible) return null;

  const showPoster = Boolean(posterUrl);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {/* Poster thumbnail */}
          <View style={styles.posterWrap}>
            {showPoster ? (
              <Image
                source={{ uri: posterUrl! }}
                style={styles.poster}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]}>
                <Ionicons name="film-outline" size={28} color={colors.textMuted} />
              </View>
            )}
          </View>
          {/* Text content */}
          <View style={styles.textCol}>
            {episodeNum ? (
              <Text style={styles.epNumText}>E{episodeNum}</Text>
            ) : (
              <Text style={styles.epNumText}>{t("series.next_episode")}</Text>
            )}
            {episodeTitle ? (
              <Text style={styles.epTitle} numberOfLines={2}>
                {episodeTitle}
              </Text>
            ) : null}
            <Text style={styles.subtitle}>
              {t("series.next_episode_in", { n: secondsLeft })}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            focusable={false}
            onPress={onPlayNow}
            style={[styles.btn, focusIndex === 0 && styles.btnSelected]}
          >
            <Text style={styles.btnText}>{t("series.play_now")}</Text>
          </Pressable>
          <Pressable
            focusable={false}
            onPress={onCancel}
            style={[styles.btn, focusIndex === 1 && styles.btnSelected]}
          >
            <Text style={styles.btnText}>{t("series.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    zIndex: 40,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    maxWidth: 480,
    minWidth: 360,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  posterWrap: {
    width: 100,
    height: 152,
    borderRadius: radius.sm,
    overflow: "hidden",
    flexShrink: 0,
  },
  poster: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surface,
  },
  posterPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  epNumText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  epTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  btnSelected: {
    borderColor: colors.brand,
    backgroundColor: "rgba(0,164,220,0.15)",
  },
  btnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});

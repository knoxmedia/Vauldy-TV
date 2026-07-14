import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  addFavorite,
  fetchFavoriteStatus,
  fetchMediaDetail,
  fetchMediaProgress,
  removeFavorite,
} from "@/api/client";
import TvBackButton, { useTvBackHandler } from "@/components/focus/TvBackButton";
import LoadingState, { Screen } from "@/components/LoadingState";
import { colors, radius, spacing } from "@/constants/theme";
import { TV_NAV_ENABLED, useTvRemoteNav } from "@/hooks/useTvRemoteNav";
import { t } from "@/i18n";
import { formatMetaRating, parseMediaMeta } from "@/lib/mediaMeta";
import {
  derivedVideoPosterSrc,
  formatDuration,
  mediaDetailPosterSrc,
  mediaPosterSrc,
  mediaReleaseYear,
} from "@/lib/mediaUrl";
import { useTvFocusStore } from "@/store/tvFocus";

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mediaId = Number(id);
  const router = useRouter();
  const goBack = useCallback(() => router.back(), [router]);
  useTvBackHandler(goBack);
  const [item, setItem] = useState<Awaited<ReturnType<typeof fetchMediaDetail>> | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [savedPosition, setSavedPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [posterUri, setPosterUri] = useState("");
  const [posterFallbackUsed, setPosterFallbackUsed] = useState(false);
  const zone = useTvFocusStore((s) => s.zone);
  const exitContentUp = useTvFocusStore((s) => s.exitContentUp);
  const exitContentDown = useTvFocusStore((s) => s.exitContentDown);
  const setZone = useTvFocusStore((s) => s.setZone);

  useFocusEffect(
    useCallback(() => {
      setZone("content");
    }, [setZone]),
  );

  useEffect(() => {
    setLoading(true);
    setSavedPosition(0);
    Promise.all([
      fetchMediaDetail(mediaId),
      fetchFavoriteStatus(mediaId),
      fetchMediaProgress(mediaId).catch(() => null),
    ])
      .then(([detail, fav, progress]) => {
        setItem(detail);
        setFavorited(fav);
        if (progress?.position && progress.position > 0) {
          setSavedPosition(progress.position);
        }
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [mediaId]);

  const meta = useMemo(() => parseMediaMeta(item?.meta_json), [item?.meta_json]);
  const primaryPoster = useMemo(() => {
    if (!item) return "";
    if (item.file_type === "image") return mediaPosterSrc(item);
    if (item.file_type === "audio" || item.file_type === "document") return mediaPosterSrc(item);
    return mediaDetailPosterSrc(item, meta.poster);
  }, [item, meta.poster]);

  useEffect(() => {
    setPosterUri(primaryPoster);
    setPosterFallbackUsed(false);
  }, [primaryPoster]);

  const primaryAction = useCallback(() => {
    if (!item) return;
    if (item.file_type === "video" || item.file_type === "audio") {
      const tParam = savedPosition > 0 ? `?t=${Math.floor(savedPosition)}` : "";
      return router.push(`/player/${item.id}${tParam}`);
    }
    if (item.file_type === "image") return router.push(`/photo/${item.id}`);
    if (item.file_type === "document") return router.push(`/reader/${item.id}`);
  }, [item, router, savedPosition]);

  const toggleFavorite = useCallback(async () => {
    if (!item) return;
    try {
      if (favorited) {
        await removeFavorite(item.id);
        setFavorited(false);
      } else {
        await addFavorite(item.id);
        setFavorited(true);
      }
    } catch {
      Alert.alert(t("common.error"));
    }
  }, [favorited, item]);

  const { index: actionIndex } = useTvRemoteNav({
    mode: "horizontal",
    count: 2,
    enabled: !loading && !!item && zone === "content",
    onSelect: (i) => {
      if (i === 0) primaryAction();
      else void toggleFavorite();
    },
    onExitUp: () => {
      exitContentUp();
    },
    onExitDown: () => {
      exitContentDown();
    },
  });

  if (loading || !item) return <LoadingState />;

  const detail = item;
  const year = mediaReleaseYear(detail) || (meta.releaseDate.length >= 4 ? meta.releaseDate.slice(0, 4) : "");
  const overview = (meta.overview || detail.overview || "").trim();
  const ratingText = formatMetaRating(meta.rating);
  const directorText = meta.director.length > 0 ? meta.director.join("、") : t("media.director_none");
  const metaParts = [
    year ? `${t("media.year")} ${year}` : "",
    detail.duration > 0 ? formatDuration(detail.duration) : "",
    meta.certification || "",
  ].filter(Boolean);

  const actionLabel =
    detail.file_type === "video"
      ? t("media.play_video")
      : detail.file_type === "audio"
        ? t("media.play_audio")
        : detail.file_type === "image"
          ? t("media.view_photo")
          : t("media.read_document");

  function handlePosterError() {
    if (!posterFallbackUsed && detail.file_type === "video") {
      const fallback = derivedVideoPosterSrc(detail.id);
      if (fallback && fallback !== posterUri) {
        setPosterFallbackUsed(true);
        setPosterUri(fallback);
        return;
      }
    }
    setPosterUri("");
  }

  const actionsSelected = zone === "content";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TvBackButton onPress={goBack} />
        </View>
        <View style={styles.hero}>
          <View style={styles.posterColumn}>
            {posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={styles.poster}
                contentFit="cover"
                onError={handlePosterError}
              />
            ) : (
              <View style={[styles.poster, styles.placeholder]}>
                <Ionicons name="film-outline" size={64} color={colors.textMuted} />
                <Text style={styles.placeholderText}>{t("media.no_poster")}</Text>
              </View>
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{detail.title || detail.file_path}</Text>
            {detail.original_title ? <Text style={styles.originalTitle}>{detail.original_title}</Text> : null}
            <Text style={styles.directorLine}>
              {t("media.director")}: {directorText}
            </Text>
            {metaParts.length > 0 ? <Text style={styles.metaLine}>{metaParts.join(" · ")}</Text> : null}
            {meta.genres.length > 0 ? (
              <View style={styles.genreRow}>
                {meta.genres.map((genre) => (
                  <View key={genre} style={styles.genreTag}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {ratingText ? <Text style={styles.ratingLine}>{t("media.rating")}: {ratingText}</Text> : null}
            <View style={styles.overviewSection}>
              <Text style={styles.overviewHeading}>{t("media.overview")}</Text>
              <Text style={styles.overview}>{overview || t("media.no_overview")}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                focusable={!TV_NAV_ENABLED}
                onPress={primaryAction}
                style={[styles.primaryBtn, actionsSelected && actionIndex === 0 && styles.btnSelected]}
              >
                <Text style={styles.primaryText}>{actionLabel}</Text>
              </Pressable>
              <Pressable
                focusable={!TV_NAV_ENABLED}
                onPress={() => void toggleFavorite()}
                style={[styles.secondaryBtn, actionsSelected && actionIndex === 1 && styles.btnSelected]}
              >
                <Text style={styles.secondaryText}>{favorited ? t("common.unfavorite") : t("common.favorite")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  topBar: { flexDirection: "row", justifyContent: "flex-end", marginBottom: spacing.md },
  hero: { flexDirection: "row", gap: spacing.xl, alignItems: "flex-start" },
  posterColumn: { width: 280 },
  poster: {
    width: 280,
    aspectRatio: 2 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: { alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderText: { color: colors.textMuted, fontSize: 14 },
  body: { flex: 1, paddingTop: spacing.sm },
  title: { color: colors.text, fontSize: 36, fontWeight: "700", marginBottom: 8 },
  originalTitle: { color: colors.textSecondary, fontSize: 20, marginBottom: 12 },
  directorLine: { color: colors.textSecondary, fontSize: 17, marginBottom: 10 },
  metaLine: { color: colors.textSecondary, fontSize: 17, marginBottom: 12 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  genreTag: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(237,109,0,0.2)",
  },
  genreText: { color: colors.accent, fontSize: 15 },
  ratingLine: { color: colors.textSecondary, fontSize: 17, marginBottom: 16 },
  overviewSection: { marginBottom: spacing.lg },
  overviewHeading: { color: colors.text, fontSize: 22, fontWeight: "600", marginBottom: 8 },
  overview: { color: colors.textSecondary, lineHeight: 28, fontSize: 18 },
  actions: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  primaryText: { color: "#fff", fontSize: 20, fontWeight: "600" },
  secondaryBtn: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: "rgba(237,109,0,0.25)",
  },
  secondaryText: { color: colors.accent, fontSize: 18, fontWeight: "600" },
  btnSelected: { borderColor: "#fff" },
});

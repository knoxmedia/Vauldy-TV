import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchSeasonEpisodes,
  fetchSeries,
  fetchSeriesPlayTarget,
  fetchUserHistory,
} from "@/api/client";
import type { EpisodeRow, HistoryItem, SeasonSummary, SeriesDetail, SeriesPlayTarget } from "@/api/types";
import TvBackButton, { useTvBackHandler } from "@/components/focus/TvBackButton";
import LoadingState, { Screen } from "@/components/LoadingState";
import EpisodeList from "@/components/series/EpisodeList";
import { colors, radius, spacing } from "@/constants/theme";
import { TV_NAV_ENABLED, useTvRemoteNav } from "@/hooks/useTvRemoteNav";
import { t } from "@/i18n";
import { normalizeListPosterUrl, withAccessToken } from "@/lib/mediaUrl";
import { ensureCanPlay } from "@/lib/playbackGate";
import {
  fetchSeriesEpisodeMediaOrder,
  pickPrimaryEpisodeMediaId,
} from "@/lib/seriesPlayback";
import { useSeriesPlayStore } from "@/store/seriesPlay";
import { useTvFocusStore } from "@/store/tvFocus";

type FocusZone = "actions" | "seasons" | "episodes";

async function startSeriesPlayback(opts: {
  seriesId: number;
  seasons: SeasonSummary[];
  mediaId: number;
  indexInOrder?: number;
  positionSec?: number;
  router: ReturnType<typeof useRouter>;
}) {
  if (!ensureCanPlay()) return;
  const { order, episodes } = await fetchSeriesEpisodeMediaOrder(opts.seasons);
  useSeriesPlayStore.getState().setSession(opts.seriesId, order, episodes);
  const index = opts.indexInOrder ?? Math.max(0, order.indexOf(opts.mediaId));
  const tParam =
    opts.positionSec && opts.positionSec > 0 ? `&t=${Math.floor(opts.positionSec)}` : "";
  opts.router.push(
    `/player/${opts.mediaId}?series_id=${opts.seriesId}&index=${index}${tParam}`,
  );
}

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = Number(id);
  const router = useRouter();
  const goBack = useCallback(() => router.back(), [router]);
  useTvBackHandler(goBack);

  const setZone = useTvFocusStore((s) => s.setZone);
  const exitContentUp = useTvFocusStore((s) => s.exitContentUp);

  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [completedMediaIds, setCompletedMediaIds] = useState<Set<number>>(new Set());
  // Finished in this app session — merged in immediately while refetches catch up.
  const localCompletedMediaIds = useSeriesPlayStore((s) => s.completedMediaIds);
  const [playTarget, setPlayTarget] = useState<SeriesPlayTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [focusZone, setFocusZone] = useState<FocusZone>("actions");

  const mergedCompletedMediaIds = useMemo(() => {
    if (localCompletedMediaIds.size === 0) return completedMediaIds;
    const merged = new Set(completedMediaIds);
    for (const id of localCompletedMediaIds) merged.add(id);
    return merged;
  }, [completedMediaIds, localCompletedMediaIds]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFocusZone("actions");
    Promise.all([
      fetchSeries(seriesId),
      fetchSeriesPlayTarget(seriesId).catch(() => null),
      fetchUserHistory(500, { libraryTypes: ["tv"] }).catch(() => [] as HistoryItem[]),
    ])
      .then(([series, target, history]) => {
        if (cancelled) return;
        const sorted = [...(series.seasons ?? [])].sort((a, b) => a.season_num - b.season_num);
        setDetail(series);
        setSeasons(sorted);
        setSeasonIndex(0);
        setPlayTarget(target);
        const completed = new Set<number>();
        for (const h of history) {
          if (h.completed && h.completed > 0 && h.media_id > 0) {
            completed.add(h.media_id);
          }
        }
        setCompletedMediaIds(completed);
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setSeasons([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const activeSeason = seasons[seasonIndex] ?? null;
  const activeSeasonIdRef = useRef<number | null>(null);
  activeSeasonIdRef.current = activeSeason?.id ?? null;

  const loadEpisodes = useCallback(
    async (seasonId: number, opts?: { silent?: boolean; cancelled?: () => boolean }) => {
      if (!opts?.silent) setEpisodesLoading(true);
      try {
        const items = await fetchSeasonEpisodes(seasonId);
        if (opts?.cancelled?.()) return;
        setEpisodes(items);
      } catch {
        if (opts?.cancelled?.()) return;
        if (!opts?.silent) setEpisodes([]);
      } finally {
        if (!opts?.silent && !opts?.cancelled?.()) setEpisodesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeSeason) {
      setEpisodes([]);
      return;
    }
    let cancelled = false;
    void loadEpisodes(activeSeason.id, { cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [activeSeason, loadEpisodes]);

  // Returning from the player: silently refetch the season so freshly
  // completed episodes (versions[].completed) show their badge without a
  // loading flash or losing remote focus. Reads the season via ref so the
  // effect isn't re-registered on tab switches.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      setZone("content");
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      const seasonId = activeSeasonIdRef.current;
      if (!seasonId) return;
      let cancelled = false;
      void loadEpisodes(seasonId, { silent: true, cancelled: () => cancelled });
      void fetchSeriesPlayTarget(seriesId)
        .then((target) => {
          if (!cancelled) setPlayTarget(target);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [loadEpisodes, seriesId, setZone]),
  );

  const hasSeasons = seasons.length > 0;
  const hasEpisodes = episodes.length > 0;

  const onContinue = useCallback(async () => {
    let target = playTarget;
    if (!target) {
      try {
        target = await fetchSeriesPlayTarget(seriesId);
        setPlayTarget(target);
      } catch {
        return;
      }
    }
    if (!target?.media_id) return;
    await startSeriesPlayback({
      seriesId,
      seasons,
      mediaId: target.media_id,
      positionSec: target.position,
      router,
    });
  }, [playTarget, router, seasons, seriesId]);

  const onPlayFromStart = useCallback(async () => {
    if (!ensureCanPlay()) return;
    const { order, episodes } = await fetchSeriesEpisodeMediaOrder(seasons);
    if (order.length === 0) return;
    const mediaId = order[0]!;
    useSeriesPlayStore.getState().setSession(seriesId, order, episodes);
    router.push(`/player/${mediaId}?series_id=${seriesId}&index=0`);
  }, [router, seasons, seriesId]);

  const onPressEpisode = useCallback(
    async (ep: EpisodeRow) => {
      const mediaId = pickPrimaryEpisodeMediaId(ep);
      if (mediaId == null) return;
      const resume =
        playTarget &&
        playTarget.media_id === mediaId &&
        playTarget.position > 0
          ? playTarget.position
          : undefined;
      await startSeriesPlayback({
        seriesId,
        seasons,
        mediaId,
        positionSec: resume,
        router,
      });
    },
    [playTarget, router, seasons, seriesId],
  );

  const { index: actionIndex } = useTvRemoteNav({
    mode: "horizontal",
    count: 2,
    enabled: !loading && !!detail && hasSeasons && focusZone === "actions",
    onSelect: (i) => {
      if (i === 0) void onContinue();
      else void onPlayFromStart();
    },
    onExitUp: () => {
      exitContentUp();
    },
    onExitDown: () => {
      if (hasSeasons) setFocusZone("seasons");
      else if (hasEpisodes) setFocusZone("episodes");
    },
  });

  const { index: seasonFocusIndex, setIndex: setSeasonFocusIndex } = useTvRemoteNav({
    mode: "horizontal",
    count: seasons.length,
    enabled: !loading && !!detail && focusZone === "seasons" && hasSeasons,
    initialIndex: seasonIndex,
    onSelect: () => {
      if (hasEpisodes) setFocusZone("episodes");
    },
    onIndexChange: (i) => {
      setSeasonIndex(i);
    },
    onExitUp: () => setFocusZone("actions"),
    onExitDown: () => {
      if (hasEpisodes || !episodesLoading) setFocusZone("episodes");
    },
  });

  useEffect(() => {
    if (focusZone === "seasons") {
      setSeasonFocusIndex(seasonIndex);
    }
  }, [focusZone, seasonIndex, setSeasonFocusIndex]);

  // Empty episode list still needs a way to go back up with the remote.
  useTvRemoteNav({
    mode: "vertical",
    count: 1,
    enabled: focusZone === "episodes" && !hasEpisodes && !episodesLoading,
    onExitUp: () => {
      if (hasSeasons) setFocusZone("seasons");
      else setFocusZone("actions");
    },
  });

  const seasonLabel = useCallback((season: SeasonSummary) => {
    const base = t("series.season", { n: season.season_num });
    const name = season.name?.trim();
    if (name && name !== base && !/^season\s*\d+$/i.test(name)) {
      return `${base} · ${name}`;
    }
    return base;
  }, []);

  const yearText = useMemo(() => {
    if (!detail?.year || detail.year <= 0) return "";
    return String(detail.year);
  }, [detail?.year]);

  const heroPosterUrl = useMemo(() => {
    if (!detail) return "";
    const metaJson = (() => { try { return JSON.parse(detail.meta_json ?? "{}"); } catch { return {}; } })();
    const scrape = metaJson?.scrape ?? {};
    const metaPoster = normalizeListPosterUrl(String(scrape?.poster ?? scrape?.series_poster ?? ""));
    const listPoster = normalizeListPosterUrl(detail.poster_url ?? detail.poster ?? "");
    const raw = metaPoster || listPoster;
    return raw ? withAccessToken(raw) : "";
  }, [detail]);

  const heroBackdropUrl = useMemo(() => {
    if (!detail) return "";
    const metaJson = (() => { try { return JSON.parse(detail.meta_json ?? "{}"); } catch { return {}; } })();
    const scrape = metaJson?.scrape ?? {};
    const raw = normalizeListPosterUrl(String(scrape?.backdrop ?? scrape?.series_backdrop ?? ""));
    return raw ? withAccessToken(raw) : "";
  }, [detail]);

  if (loading) return <LoadingState />;

  if (!detail) {
    return (
      <Screen>
        <View style={styles.root}>
          <View style={styles.topBar}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t("series.empty")}</Text>
            </View>
            <TvBackButton onPress={goBack} />
          </View>
        </View>
      </Screen>
    );
  }

  const actionsSelected = focusZone === "actions";
  const seasonsSelected = focusZone === "seasons";

  return (
    <Screen>
      <View style={styles.root}>
        {/* Hero section with backdrop + poster */}
        {heroBackdropUrl ? (
          <View style={styles.heroBanner}>
            <Image
              source={{ uri: heroBackdropUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
            <View style={styles.heroOverlay} />
          </View>
        ) : null}
        <View style={styles.heroSection}>
          <View style={styles.posterCol}>
            {heroPosterUrl ? (
              <Image
                source={{ uri: heroPosterUrl }}
                style={styles.heroPoster}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View style={[styles.heroPoster, styles.heroPosterPlaceholder]}>
                <Ionicons name="film-outline" size={40} color={colors.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.topBar}>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={2}>
                  {detail.title}
                </Text>
                {yearText ? <Text style={styles.year}>{yearText}</Text> : null}
              </View>
              <TvBackButton onPress={goBack} />
            </View>
          </View>
        </View>

        {hasSeasons ? (
          <View style={styles.actions}>
            <Pressable
              focusable={!TV_NAV_ENABLED}
              onPress={TV_NAV_ENABLED ? undefined : () => void onContinue()}
              style={[
                styles.primaryBtn,
                actionsSelected && actionIndex === 0 && styles.btnSelected,
              ]}
            >
              <Text style={styles.primaryText}>{t("series.continue")}</Text>
            </Pressable>
            <Pressable
              focusable={!TV_NAV_ENABLED}
              onPress={TV_NAV_ENABLED ? undefined : () => void onPlayFromStart()}
              style={[
                styles.secondaryBtn,
                actionsSelected && actionIndex === 1 && styles.btnSelected,
              ]}
            >
              <Text style={styles.secondaryText}>{t("series.play_from_start")}</Text>
            </Pressable>
          </View>
        ) : null}

        {hasSeasons ? (
          <View style={styles.seasonRow}>
            {seasons.map((season, i) => {
              const selected = seasonsSelected && seasonFocusIndex === i;
              const active = seasonIndex === i;
              return (
                <Pressable
                  key={season.id}
                  focusable={!TV_NAV_ENABLED}
                  onPress={TV_NAV_ENABLED ? undefined : () => {
                    setSeasonIndex(i);
                    setFocusZone("seasons");
                  }}
                  style={[
                    styles.seasonTab,
                    active && styles.seasonTabActive,
                    selected && styles.seasonTabSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.seasonTabText,
                      active && styles.seasonTabTextActive,
                    ]}
                  >
                    {seasonLabel(season)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {episodesLoading ? (
            <LoadingState />
          ) : (
            <EpisodeList
              episodes={episodes}
              completedMediaIds={mergedCompletedMediaIds}
              enabled={focusZone === "episodes" && hasEpisodes}
              resetIndexKey={activeSeason?.id ?? ""}
              onExitUp={() => {
                if (hasSeasons) setFocusZone("seasons");
                else setFocusZone("actions");
              }}
              onExitLeft={() => {
                if (hasSeasons) setFocusZone("seasons");
                else setFocusZone("actions");
              }}
              onPressEpisode={(ep) => void onPressEpisode(ep)}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
  },
  year: {
    color: colors.textSecondary,
    fontSize: 18,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  secondaryBtn: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderWidth: 2,
    borderColor: "rgba(237,109,0,0.25)",
  },
  secondaryText: { color: colors.accent, fontSize: 18, fontWeight: "600" },
  btnSelected: { borderColor: "#fff" },
  seasonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  seasonTab: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceElevated,
  },
  seasonTabActive: {
    backgroundColor: "rgba(0,164,220,0.15)",
  },
  seasonTabSelected: {
    borderColor: colors.brand,
  },
  seasonTabText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  seasonTabTextActive: {
    color: colors.brand,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  heroBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 240,
    zIndex: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heroSection: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    zIndex: 1,
  },
  posterCol: {
    flexShrink: 0,
  },
  heroPoster: {
    width: 140,
    height: 210,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroPosterPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroMeta: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
  },
});

import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  fetchMedia,
  fetchMediaDetail,
  fetchPlaybackPlan,
  fetchSeasonEpisodes,
  playbackEnd,
  playbackStart,
  saveProgress,
} from "@/api/client";
import type { MediaDetail } from "@/api/types";
import { useTvBackHandler } from "@/components/focus/TvBackButton";
import { registerTvKeyHandler, consumeTvKeyEvent, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import FocusablePressable from "@/components/focus/FocusablePressable";
import MusicPlayerView from "@/components/player/MusicPlayerView";
import NextEpisodeOverlay from "@/components/player/NextEpisodeOverlay";
import TvVideoPlayerOverlay from "@/components/player/TvVideoPlayerOverlay";
import { colors } from "@/constants/theme";
import { useTvControlsVisibility } from "@/hooks/useTvControlsVisibility";
import { t } from "@/i18n";
import { parseMusicTags } from "@/lib/musicTags";
import { albumArtworkSrc, mediaPlaySrc, mediaPosterSrc, musicMediaPosterSrc, normalizeListPosterUrl, withAccessToken } from "@/lib/mediaUrl";
import { resolveNextSeriesMedia } from "@/lib/seriesPlayback";
import { useMusicPlayerStore } from "@/store/musicPlayer";
import { useSeriesPlayStore } from "@/store/seriesPlay";

const PROGRESS_SAVE_INTERVAL_MS = 30_000;

async function enrichMusicDetail(detail: MediaDetail): Promise<MediaDetail> {
  if (detail.music_album_id || !detail.library_id) return detail;
  try {
    const items = await fetchMedia(detail.library_id, { file_type: "audio", limit: 500 });
    const found = items.find((item) => item.id === detail.id);
    if (!found) return detail;
    return {
      ...detail,
      music_album_id: found.music_album_id,
      music_album_title: found.music_album_title,
      music_artist: found.music_artist,
      poster_url: found.poster_url ?? detail.poster_url,
    };
  } catch {
    return detail;
  }
}

export default function PlayerScreen() {
  const { id, series_id, index, t: resumeT } = useLocalSearchParams<{
    id: string;
    series_id?: string;
    index?: string;
    t?: string;
  }>();
  const mediaId = Number(id);
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const isAudioRef = useRef(false);
  const didResumeSeek = useRef(false);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [isAudio, setIsAudio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsVisibleRef = useRef(false);
  const lastPosition = useRef(0);
  const lastSavedPosition = useRef(0);
  const controls = useTvControlsVisibility();
  const [nextEpisode, setNextEpisode] = useState<{ mediaId: number; index: number } | null>(null);
  const [nextCountdown, setNextCountdown] = useState(0);
  const [nextFocus, setNextFocus] = useState(0);
  const [nextEpisodeMeta, setNextEpisodeMeta] = useState<{
    title: string;
    posterUrl: string;
    episodeNum: number;
  } | null>(null);
  const nextEpisodeRef = useRef(nextEpisode);
  const nextFocusRef = useRef(nextFocus);
  nextEpisodeRef.current = nextEpisode;
  nextFocusRef.current = nextFocus;
  const keepAwakeRef = useRef(false);
  const nearEndTriggeredRef = useRef(false);

  const setControlsVisibleSafe = useCallback((v: boolean) => {
    controlsVisibleRef.current = v;
    setControlsVisible(v);
  }, []);

  const musicPlaying = useMusicPlayerStore((s) => s.playing);
  const musicPosition = useMusicPlayerStore((s) => s.position);
  const musicDuration = useMusicPlayerStore((s) => s.duration);
  const musicMediaId = useMusicPlayerStore((s) => s.mediaId);
  const musicTitle = useMusicPlayerStore((s) => s.title);
  const musicArtist = useMusicPlayerStore((s) => s.artist);
  const musicAlbumTitle = useMusicPlayerStore((s) => s.albumTitle);
  const musicCoverUri = useMusicPlayerStore((s) => s.coverUri);
  const musicToggle = useMusicPlayerStore((s) => s.toggle);
  const musicSeekBy = useMusicPlayerStore((s) => s.seekBy);
  const musicStop = useMusicPlayerStore((s) => s.stop);
  const musicPrev = useMusicPlayerStore((s) => s.prev);
  const musicNext = useMusicPlayerStore((s) => s.next);
  const musicQueue = useMusicPlayerStore((s) => s.queue);
  const musicQueueIndex = useMusicPlayerStore((s) => s.queueIndex);
  const setMusicFullscreen = useMusicPlayerStore((s) => s.setFullscreen);
  const isFocused = useIsFocused();

  useEffect(() => {
    setMusicFullscreen(true);
    return () => setMusicFullscreen(false);
  }, [setMusicFullscreen]);

  // Keep the player route in sync when the queue advances (next/prev/auto),
  // so lyrics and metadata follow the current track.
  useEffect(() => {
    if (!isAudio || !musicMediaId || musicMediaId === mediaId) return;
    router.replace(`/player/${musicMediaId}`);
  }, [isAudio, musicMediaId, mediaId, router]);

  useEffect(() => {
    didResumeSeek.current = false;
    nearEndTriggeredRef.current = false;
    setNextEpisode(null);
    setNextCountdown(0);
    setNextFocus(0);
    setNextEpisodeMeta(null);
    lastPosition.current = 0;
    lastSavedPosition.current = 0;

    // Soft handoff: store already advanced to this track — keep MusicPlayerView mounted
    // so lyrics/title update without flashing the loading screen.
    const music = useMusicPlayerStore.getState();
    const softAudioHandoff =
      music.active && music.mediaId === mediaId && (isAudioRef.current || music.fullscreen);
    if (!softAudioHandoff) {
      setLoading(true);
      setError(null);
      setUri(null);
      setDetail(null);
    }
  }, [mediaId]);

  useEffect(() => {
    if (!series_id) useSeriesPlayStore.getState().clearSession();
  }, [series_id, mediaId]);

  const persistProgress = useCallback(
    (completed = false) => {
      const pos = Math.floor(lastPosition.current);
      if (pos <= 0 && !completed) return;
      if (!completed && pos === lastSavedPosition.current) return;
      lastSavedPosition.current = pos;
      saveProgress(mediaId, pos, completed).catch(() => {});
    },
    [mediaId],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mediaDetail = await fetchMediaDetail(mediaId);
        const enriched = mediaDetail.file_type === "audio" ? await enrichMusicDetail(mediaDetail) : mediaDetail;
        if (!mounted) return;
        setDetail(enriched);
        const audio = enriched.file_type === "audio";
        isAudioRef.current = audio;
        setIsAudio(audio);

        if (audio) {
          const tags = parseMusicTags(enriched.meta_json);
          const artist = enriched.music_artist || tags.artist;
          const albumTitle = enriched.music_album_title || tags.album;
          const coverUri =
            (enriched.music_album_id && enriched.music_album_id > 0 ? albumArtworkSrc(enriched.music_album_id) : null) ||
            musicMediaPosterSrc(enriched) ||
            mediaPosterSrc(enriched) ||
            "";
          const playUri = mediaPlaySrc(mediaId);
          setUri(playUri);

          const current = useMusicPlayerStore.getState();
          if (!(current.active && current.mediaId === mediaId)) {
            useMusicPlayerStore.getState().setLyricsExpanded(false);
            useMusicPlayerStore.getState().start({
              mediaId,
              title: enriched.title || enriched.file_path,
              artist,
              albumTitle,
              coverUri,
              playUri,
            });
          }
          return;
        }

        useMusicPlayerStore.getState().pauseForVideo();
        await playbackStart(mediaId);
        const plan = await fetchPlaybackPlan(mediaId);
        if (plan.hls_master) setUri(withAccessToken(plan.hls_master));
        else if (plan.fallback) setUri(withAccessToken(plan.fallback));
        else setUri(mediaPlaySrc(mediaId));
      } catch {
        if (mounted) setError(t("player.error"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (keepAwakeRef.current) {
        deactivateKeepAwake("video-player").catch(() => {});
        keepAwakeRef.current = false;
      }
      if (isAudioRef.current) {
        return;
      }
      useMusicPlayerStore.getState().resumeAfterVideo();
      playbackEnd(mediaId).catch(() => {});
      persistProgress(false);
    };
  }, [mediaId, persistProgress]);

  useEffect(() => {
    if (!isAudio) return;
    const timer = setInterval(() => {
      const pos = Math.floor(useMusicPlayerStore.getState().position);
      if (pos > 0 && pos !== lastSavedPosition.current) {
        lastSavedPosition.current = pos;
        saveProgress(mediaId, pos, false).catch(() => {});
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAudio, mediaId]);

  const cancelNext = useCallback(() => {
    nearEndTriggeredRef.current = false;
    setNextEpisode(null);
    setNextCountdown(0);
    setNextFocus(0);
    setNextEpisodeMeta(null);
  }, []);

  const goNextEpisode = useCallback(() => {
    const next = nextEpisodeRef.current;
    if (!next || !series_id) return;
    const sid = Number(series_id);
    const { mediaId: nextId, index: nextIndex } = next;
    setNextEpisode(null);
    setNextCountdown(0);
    setNextFocus(0);
    router.replace(`/player/${nextId}?series_id=${sid}&index=${nextIndex}`);
  }, [router, series_id]);

  useEffect(() => {
    if (!nextEpisode) return;
    if (nextCountdown <= 0) {
      goNextEpisode();
      return;
    }
    const timer = setTimeout(() => setNextCountdown((sec) => sec - 1), 1000);
    return () => clearTimeout(timer);
  }, [nextEpisode, nextCountdown, goNextEpisode]);

  const tryResumeSeek = useCallback(
    async (status: AVPlaybackStatus & { isLoaded: true }) => {
      if (didResumeSeek.current) return;
      const resumeSec = resumeT != null && resumeT !== "" ? Number(resumeT) : NaN;
      if (!Number.isFinite(resumeSec) || resumeSec <= 0) {
        didResumeSeek.current = true;
        return;
      }
      const durSec = (status.durationMillis ?? 0) / 1000;
      if (durSec <= 0) return;
      didResumeSeek.current = true;
      const target = Math.min(resumeSec, Math.max(0, durSec - 1));
      try {
        await videoRef.current?.setPositionAsync(target * 1000);
        lastPosition.current = target;
        setPosition(target);
      } catch {
        /* ignore */
      }
    },
    [resumeT],
  );

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setError(t("player.error"));
      return;
    }
    void tryResumeSeek(status);
    const pos = status.positionMillis / 1000;
    lastPosition.current = pos;
    setPosition(pos);
    setDuration((status.durationMillis ?? 0) / 1000);
    setPlaying(status.isPlaying);
    // Keep screen awake during video playback (not audio).
    if (!isAudioRef.current) {
      if (status.isPlaying && !keepAwakeRef.current) {
        keepAwakeRef.current = true;
        activateKeepAwakeAsync("video-player").catch(() => {});
      } else if (!status.isPlaying && keepAwakeRef.current) {
        keepAwakeRef.current = false;
        deactivateKeepAwake("video-player").catch(() => {});
      }
    }
    // Near-end detection: pre-fetch next episode metadata when approaching end.
    const dur = (status.durationMillis ?? 0) / 1000;
    const nearEndThreshold = dur > 30 ? 30 : dur * 0.15;
    if (
      !nearEndTriggeredRef.current &&
      dur > 0 &&
      dur - pos <= nearEndThreshold &&
      series_id &&
      !nextEpisode
    ) {
      nearEndTriggeredRef.current = true;
      const sid = Number(series_id);
      const session = useSeriesPlayStore.getState().session;
      if (session && sid === session.seriesId) {
        const idx = index != null && index !== "" ? Number(index) : NaN;
        const next = resolveNextSeriesMedia(session, mediaId, Number.isFinite(idx) ? idx : null);
        if (next?.seasonId != null) {
          fetchSeasonEpisodes(next.seasonId)
            .then((items) => {
              const sorted = [...items].sort((a, b) => a.episode_num - b.episode_num);
              const nextEp = sorted.find((ep) => ep.episode_num === next.episodeNum);
              if (!nextEp) return;
              const versions = (nextEp.versions ?? [])
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const v = versions[0];
              const rawPoster = v?.poster_url;
              const posterUrl = rawPoster ? withAccessToken(normalizeListPosterUrl(rawPoster)) : "";
              setNextEpisodeMeta({
                title: nextEp.title?.trim() || `Episode ${nextEp.episode_num}`,
                posterUrl,
                episodeNum: nextEp.episode_num,
              });
            })
            .catch(() => {});
        }
      }
    }
    if (status.didJustFinish) {
      persistProgress(true);
      const sid = series_id ? Number(series_id) : NaN;
      const session = useSeriesPlayStore.getState().session;
      if (session && Number.isFinite(sid) && sid === session.seriesId) {
        const idx = index != null && index !== "" ? Number(index) : NaN;
        const next = resolveNextSeriesMedia(session, mediaId, Number.isFinite(idx) ? idx : null);
        if (next) {
          setNextEpisode(next);
          setNextFocus(0);
          // Shorter countdown when metadata is already pre-fetched.
          if (nextEpisodeMeta) {
            setNextCountdown(5);
          } else {
            setNextCountdown(10);
          }
          setControlsVisibleSafe(false);
          return;
        }
        useSeriesPlayStore.getState().clearSession();
      }
    }
  };

  const seekBy = useCallback(
    async (deltaSec: number) => {
      const next = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, position + deltaSec));
      lastPosition.current = next;
      setPosition(next);
      try {
        await videoRef.current?.setPositionAsync(next * 1000);
      } catch {
        /* ignore */
      }
      controls.bump(setControlsVisibleSafe);
    },
    [controls, duration, position, setControlsVisibleSafe],
  );

  const toggleVideoPlay = useCallback(async () => {
    try {
      if (playing) {
        await videoRef.current?.pauseAsync();
      } else {
        await videoRef.current?.playAsync();
      }
    } catch {
      /* ignore */
    }
    controls.bump(setControlsVisibleSafe);
  }, [controls, playing, setControlsVisibleSafe]);

  const stopVideo = useCallback(async () => {
    try {
      await videoRef.current?.pauseAsync();
      await videoRef.current?.setPositionAsync(0);
    } catch {
      /* ignore */
    }
    persistProgress(false);
    router.back();
  }, [persistProgress, router]);

  const showControls = useCallback(() => {
    if (nextEpisodeRef.current) return;
    controls.show(setControlsVisibleSafe);
  }, [controls, setControlsVisibleSafe]);

  const bumpControls = useCallback(() => {
    if (nextEpisodeRef.current) return;
    controls.bump(setControlsVisibleSafe);
  }, [controls, setControlsVisibleSafe]);

  const handleHardwareBack = useCallback(() => {
    if (nextEpisodeRef.current) {
      cancelNext();
      return;
    }
    if (!isAudioRef.current) persistProgress(false);
    router.back();
  }, [cancelNext, persistProgress, router]);

  useTvBackHandler(handleHardwareBack);

  useEffect(() => {
    const handler = (evt: TvKeyEvent) => {
      if (!isFocused || isAudio || loading || error) return;
      const type = evt.eventType;
      if (type === "focus" || type === "blur") return;
      consumeTvKeyEvent(evt);

      if (nextEpisodeRef.current) {
        if (type === "left" || type === "right") {
          setNextFocus((i) => (i === 0 ? 1 : 0));
          return;
        }
        if (type === "select") {
          if (nextFocusRef.current === 0) goNextEpisode();
          else cancelNext();
          return;
        }
        if (type === "menu") {
          cancelNext();
          return;
        }
        return;
      }

      if (type === "playPause") {
        showControls();
        void toggleVideoPlay();
        return;
      }

      if (!controlsVisibleRef.current) {
        if (type === "left" || type === "longLeft") {
          showControls();
          void seekBy(type === "longLeft" ? -60 : -30);
          return;
        }
        if (type === "right" || type === "longRight") {
          showControls();
          void seekBy(type === "longRight" ? 60 : 30);
          return;
        }
        if (type === "up" || type === "down" || type === "select" || type === "menu") {
          showControls();
        }
      }
    };
    return registerTvKeyHandler(handler);
  }, [isFocused, isAudio, loading, error, showControls, toggleVideoPlay, seekBy, goNextEpisode, cancelNext]);

  const handleStop = () => {
    musicStop();
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={styles.loadingText}>{t("player.loading")}</Text>
      </View>
    );
  }

  if (error || !uri || !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t("player.error")}</Text>
        <FocusablePressable preferredFocus onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </FocusablePressable>
      </View>
    );
  }

  const tags = parseMusicTags(detail.meta_json);
  const artist = detail.music_artist || tags.artist;
  const albumTitle = detail.music_album_title || tags.album;
  const coverUri =
    (detail.music_album_id && detail.music_album_id > 0 ? albumArtworkSrc(detail.music_album_id) : null) ||
    musicMediaPosterSrc(detail) ||
    mediaPosterSrc(detail) ||
    "";

  if (isAudio) {
    const viewMediaId = musicMediaId ?? mediaId;
    return (
      <MusicPlayerView
        mediaId={viewMediaId}
        title={musicTitle || detail.title || detail.file_path}
        artist={musicArtist || artist}
        albumTitle={musicAlbumTitle || albumTitle}
        coverUri={musicCoverUri || coverUri}
        playing={musicPlaying}
        position={musicPosition}
        duration={musicDuration}
        onTogglePlay={musicToggle}
        onSeekBy={musicSeekBy}
        onPrev={musicPrev}
        onNext={musicNext}
        canGoPrev={musicQueue.length > 0 && (musicPosition > 3 || musicQueueIndex > 0)}
        canGoNext={musicQueue.length > 0 && musicQueueIndex + 1 < musicQueue.length}
        onBack={() => router.back()}
        onStop={handleStop}
      />
    );
  }

  const overlayVisible = !!nextEpisode;

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onError={() => setError(t("player.error"))}
      />
      {/*
        Android TV: useTVEventHandler only receives keys if at least one focusable
        view exists. Overlay buttons use focusable={false}, and the bar is hidden
        while playing — keep a tiny preferred-focus sink mounted always.
      */}
      <Pressable
        focusable
        hasTVPreferredFocus
        accessible
        style={styles.tvEventSink}
        onPress={() => {
          if (nextEpisodeRef.current) {
            if (nextFocusRef.current === 0) goNextEpisode();
            else cancelNext();
            return;
          }
          if (!controlsVisibleRef.current) showControls();
        }}
      />
      <TvVideoPlayerOverlay
        visible={controlsVisible && !overlayVisible}
        title={detail.title || detail.file_path}
        playing={playing}
        position={position}
        duration={duration}
        onTogglePlay={() => void toggleVideoPlay()}
        onSeekBy={(delta) => void seekBy(delta)}
        onStop={() => void stopVideo()}
        onBack={() => {
          persistProgress(false);
          router.back();
        }}
        onInteraction={bumpControls}
      />
      <NextEpisodeOverlay
        visible={overlayVisible}
        secondsLeft={nextCountdown}
        episodeTitle={nextEpisodeMeta?.title}
        episodeNum={nextEpisodeMeta?.episodeNum}
        posterUrl={nextEpisodeMeta?.posterUrl}
        focusIndex={nextFocus}
        onPlayNow={goNextEpisode}
        onCancel={cancelNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1, width: "100%" },
  tvEventSink: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    left: 0,
    top: 0,
    zIndex: 1,
  },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { color: colors.textSecondary, fontSize: 18 },
  errorText: { color: colors.error, fontSize: 20 },
  backBtn: { backgroundColor: colors.overlay, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  backText: { color: colors.brand, fontSize: 18 },
});

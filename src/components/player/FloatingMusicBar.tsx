import { useEffect, useMemo, useRef } from "react";
import { useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MusicCoverArt from "@/components/player/MusicCoverArt";
import MusicLyricsPanel from "@/components/player/MusicLyricsPanel";
import { colors, radius, spacing } from "@/constants/theme";
import { TV_NAV_ENABLED, useTvRemoteNav } from "@/hooks/useTvRemoteNav";
import { useMusicPlayerStore } from "@/store/musicPlayer";
import { useTvFocusStore } from "@/store/tvFocus";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type BarAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
};

export default function FloatingMusicBar() {
  const segments = useSegments();
  const inAuth = segments[0] === "login" || segments[0] === "setup";
  const onPlayerScreen = segments[0] === "player";
  const active = useMusicPlayerStore((s) => s.active);
  const fullscreen = useMusicPlayerStore((s) => s.fullscreen);
  const previewBarHidden = useMusicPlayerStore((s) => s.previewBarHidden);
  const videoPausedMusic = useMusicPlayerStore((s) => s.videoPausedMusic);
  const lyricsExpanded = useMusicPlayerStore((s) => s.lyricsExpanded);
  const mediaId = useMusicPlayerStore((s) => s.mediaId);
  const title = useMusicPlayerStore((s) => s.title);
  const artist = useMusicPlayerStore((s) => s.artist);
  const albumTitle = useMusicPlayerStore((s) => s.albumTitle);
  const coverUri = useMusicPlayerStore((s) => s.coverUri);
  const playing = useMusicPlayerStore((s) => s.playing);
  const position = useMusicPlayerStore((s) => s.position);
  const duration = useMusicPlayerStore((s) => s.duration);
  const toggle = useMusicPlayerStore((s) => s.toggle);
  const stop = useMusicPlayerStore((s) => s.stop);
  const prev = useMusicPlayerStore((s) => s.prev);
  const next = useMusicPlayerStore((s) => s.next);
  const queue = useMusicPlayerStore((s) => s.queue);
  const queueIndex = useMusicPlayerStore((s) => s.queueIndex);
  const setLyricsExpanded = useMusicPlayerStore((s) => s.setLyricsExpanded);

  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const setMusicBarVisible = useTvFocusStore((s) => s.setMusicBarVisible);

  const canGoPrev = queue.length > 0 && (position > 3 || queueIndex > 0);
  const canGoNext = queue.length > 0 && queueIndex + 1 < queue.length;
  const barVisible =
    !inAuth && active && !fullscreen && !onPlayerScreen && !previewBarHidden && !videoPausedMusic && !!mediaId;

  useEffect(() => {
    setMusicBarVisible(!!barVisible);
    return () => setMusicBarVisible(false);
  }, [barVisible, setMusicBarVisible]);

  useEffect(() => {
    if (!barVisible && zone === "musicbar") setZone("content");
  }, [barVisible, zone, setZone]);

  const actions = useMemo<BarAction[]>(() => {
    if (!mediaId) return [];
    return [
      {
        key: "expand",
        icon: lyricsExpanded ? "chevron-down" : "chevron-up",
        onPress: () => setLyricsExpanded(!lyricsExpanded),
      },
      {
        key: "prev",
        icon: "play-skip-back",
        onPress: prev,
        disabled: !canGoPrev,
      },
      {
        key: "play",
        icon: playing ? "pause" : "play",
        iconSize: 28,
        onPress: toggle,
        primary: true,
      },
      {
        key: "next",
        icon: "play-skip-forward",
        onPress: next,
        disabled: !canGoNext,
      },
      {
        key: "stop",
        icon: "stop",
        iconSize: 22,
        onPress: stop,
      },
    ];
  }, [
    canGoNext,
    canGoPrev,
    lyricsExpanded,
    mediaId,
    next,
    playing,
    prev,
    setLyricsExpanded,
    stop,
    toggle,
  ]);

  const playIndex = Math.max(0, actions.findIndex((a) => a.key === "play"));
  const barActive = TV_NAV_ENABLED && barVisible && zone === "musicbar";
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const wasBarActive = useRef(false);

  const { index: focusIndex, setIndex } = useTvRemoteNav({
    mode: "controls",
    count: actions.length,
    initialIndex: playIndex,
    requireScreenFocus: false,
    enabled: barActive,
    loop: false,
    onSelect: (i) => {
      const action = actionsRef.current[i];
      if (action && !action.disabled) action.onPress();
    },
    onExitLeft: () => {
      setLyricsExpanded(false);
      setZone("content");
    },
    onExitUp: () => {
      setLyricsExpanded(false);
      setZone("content");
    },
    onExitDown: () => {
      setLyricsExpanded(false);
      setZone("content");
    },
  });

  useEffect(() => {
    if (barActive && !wasBarActive.current) {
      setIndex(playIndex);
    }
    wasBarActive.current = barActive;
  }, [barActive, playIndex, setIndex]);

  if (!barVisible || !mediaId) return null;

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const subtitle = [artist, albumTitle].filter(Boolean).join(" — ");

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {lyricsExpanded ? (
        <View style={styles.lyricsOverlay}>
          <View style={styles.mainWithLyrics}>
            <View style={styles.artBlock}>
              <View style={styles.coverWrap}>
                <MusicCoverArt uri={coverUri} style={styles.coverImg} iconSize={72} />
              </View>
              <Text style={styles.artTitle} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.artSub} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <MusicLyricsPanel mediaId={mediaId} position={position} playing={playing} variant="fullscreen" />
          </View>
        </View>
      ) : null}

      <View style={[styles.bar, barActive && styles.barActive]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.row}>
          <View style={styles.left}>
            <View style={styles.coverBtn}>
              <MusicCoverArt uri={coverUri} style={styles.poster} iconSize={22} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.centerOverlay} pointerEvents="box-none">
            <View style={styles.center} pointerEvents="auto">
              <View style={styles.controls}>
                {actions.map((action, index) => {
                  const selected = barActive && focusIndex === index;
                  const color = action.disabled ? colors.textMuted : action.primary ? "#0a0a0a" : colors.text;
                  return (
                    <Pressable
                      key={action.key}
                      focusable={false}
                      disabled={action.disabled}
                      onPress={action.onPress}
                      style={[
                        action.primary ? styles.playBtn : styles.iconBtn,
                        action.disabled && styles.iconBtnDisabled,
                        selected && (action.primary ? styles.playBtnSelected : styles.iconBtnSelected),
                      ]}
                    >
                      <Ionicons name={action.icon} size={action.iconSize ?? 24} color={color} />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.timeCenter}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 12,
    justifyContent: "flex-end",
    pointerEvents: "box-none",
  },
  lyricsOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  mainWithLyrics: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: spacing.xl,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  artBlock: { width: 320, flexShrink: 0, alignItems: "center" },
  coverWrap: {
    width: 280,
    height: 280,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coverImg: { width: "100%", height: "100%" },
  artTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: spacing.lg,
    textAlign: "center",
  },
  artSub: { color: colors.textSecondary, fontSize: 16, marginTop: 8, textAlign: "center" },
  bar: {
    marginHorizontal: 0,
    marginBottom: 0,
    backgroundColor: "#0a0a0a",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    overflow: "hidden",
  },
  barActive: {
    borderTopColor: colors.brand,
    borderTopWidth: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 72,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    zIndex: 1,
  },
  coverBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  poster: { width: "100%", height: "100%" },
  meta: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", gap: 4 },
  controls: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  playBtnSelected: { borderColor: "#fff", backgroundColor: "#f59a1a" },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconBtnSelected: {
    borderColor: colors.brand,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconBtnDisabled: { opacity: 0.45 },
  timeCenter: { color: colors.textSecondary, fontSize: 13 },
});

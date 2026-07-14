import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { fetchMediaLyrics } from "@/api/client";
import MusicCoverArt from "@/components/player/MusicCoverArt";
import { colors, radius, spacing } from "@/constants/theme";
import { registerTvKeyHandler, consumeTvKeyEvent, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { t } from "@/i18n";
import { activeLrcIndex, parseLrc } from "@/lib/lrc";

const LYRIC_LINE_HEIGHT = 44;

type Props = {
  mediaId: number;
  title: string;
  artist: string;
  albumTitle: string;
  coverUri: string;
  playing: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onSeekBy: (deltaSec: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onBack: () => void;
  onStop: () => void;
};

type ControlItem = {
  key: string;
  label?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MusicPlayerView({
  mediaId,
  title,
  artist,
  albumTitle,
  coverUri,
  playing,
  position,
  duration,
  onTogglePlay,
  onSeekBy,
  onPrev,
  onNext,
  canGoPrev = false,
  canGoNext = false,
  onBack,
  onStop,
}: Props) {
  const lyricsScrollRef = useRef<ScrollView>(null);
  const [lrcRaw, setLrcRaw] = useState("");
  const [zone, setZone] = useState<"back" | "controls">("controls");
  const isFocused = useIsFocused();

  const controls = useMemo<ControlItem[]>(() => {
    const items: ControlItem[] = [];
    if (onPrev) {
      items.push({
        key: "prev",
        icon: "play-skip-back",
        onPress: onPrev,
        disabled: !canGoPrev,
      });
    }
    items.push({
      key: "rewind",
      icon: "play-back",
      label: "30s",
      onPress: () => onSeekBy(-30),
    });
    items.push({
      key: "play",
      icon: playing ? "pause" : "play",
      iconSize: 36,
      onPress: onTogglePlay,
      primary: true,
    });
    items.push({
      key: "forward",
      icon: "play-forward",
      label: "30s",
      onPress: () => onSeekBy(30),
    });
    if (onNext) {
      items.push({
        key: "next",
        icon: "play-skip-forward",
        onPress: onNext,
        disabled: !canGoNext,
      });
    }
    items.push({
      key: "stop",
      icon: "stop",
      iconSize: 26,
      label: t("player.stop"),
      onPress: onStop,
    });
    return items;
  }, [canGoNext, canGoPrev, onNext, onPrev, onSeekBy, onStop, onTogglePlay, playing]);

  const playIndex = Math.max(0, controls.findIndex((c) => c.key === "play"));
  const [controlIndex, setControlIndex] = useState(playIndex);

  useEffect(() => {
    setControlIndex(playIndex);
  }, [playIndex]);

  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const controlIndexRef = useRef(controlIndex);
  controlIndexRef.current = controlIndex;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  useEffect(() => {
    const handler = (evt: TvKeyEvent) => {
      if (!isFocused) return;
      const type = evt.eventType;
      const z = zoneRef.current;
      const ci = controlIndexRef.current;
      consumeTvKeyEvent(evt);

      if (type === "select") {
        if (z === "back") {
          onBack();
          return;
        }
        const item = controlsRef.current[ci];
        if (item && !item.disabled) item.onPress();
        return;
      }
      if (z === "back") {
        if (type === "down") setZone("controls");
        return;
      }
      if (type === "up") {
        setZone("back");
        return;
      }
      if (type === "left") {
        setControlIndex((i) => (i > 0 ? i - 1 : controlsRef.current.length - 1));
        return;
      }
      if (type === "right") {
        setControlIndex((i) => (i < controlsRef.current.length - 1 ? i + 1 : 0));
      }
    };
    return registerTvKeyHandler(handler);
  }, [isFocused, onBack, setZone]);

  const lines = useMemo(() => parseLrc(lrcRaw), [lrcRaw]);
  const activeIdx = activeLrcIndex(lines, position);
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const subtitle = [artist, albumTitle].filter(Boolean).join(" — ");

  useEffect(() => {
    let cancelled = false;
    setLrcRaw("");
    fetchMediaLyrics(mediaId)
      .then((res) => {
        if (!cancelled) setLrcRaw(res?.lrc ?? "");
      })
      .catch(() => {
        if (!cancelled) setLrcRaw("");
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  useEffect(() => {
    if (activeIdx < 0 || !lyricsScrollRef.current) return;
    const offset = Math.max(0, activeIdx * LYRIC_LINE_HEIGHT - 180);
    lyricsScrollRef.current.scrollTo({ y: offset, animated: playing });
  }, [activeIdx, playing]);

  const lyricsPanel = (
    <View style={styles.lyricsPanel} focusable={false}>
      {lines.length > 0 ? (
        <ScrollView
          ref={lyricsScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.lyricsContent}
        >
          {lines.map((line, idx) => (
            <Text
              key={`${line.timeSec}-${idx}-${line.text}`}
              style={[
                styles.lyricLine,
                idx === activeIdx ? styles.lyricActive : undefined,
                idx < activeIdx ? styles.lyricPast : undefined,
              ]}
            >
              {line.text}
            </Text>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noLyricsWrap}>
          <Text style={styles.noLyrics}>{t("player.no_lyrics")}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          focusable={false}
          onPress={onBack}
          style={[styles.topBtn, zone === "back" && styles.topBtnSelected]}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
          <Text style={styles.topBtnText}>{t("common.back")}</Text>
        </Pressable>
      </View>

      <View style={styles.main} focusable={false}>
        <View style={styles.mainInner}>
          <View style={styles.artBlock}>
            <View style={styles.coverWrap}>
              <MusicCoverArt uri={coverUri} style={styles.coverImg} iconSize={72} />
            </View>
            <Text style={styles.trackTitle} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.trackSub} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {lyricsPanel}
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.timeText}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
        <View style={styles.controls}>
          {controls.map((item, index) => {
            const selected = zone === "controls" && controlIndex === index;
            const color = item.disabled ? colors.textMuted : colors.text;
            return (
              <Pressable
                key={item.key}
                focusable={false}
                disabled={item.disabled}
                onPress={item.onPress}
                style={[
                  item.primary ? styles.playBtn : styles.iconBtn,
                  item.disabled && styles.iconBtnDisabled,
                  selected && (item.primary ? styles.playBtnSelected : styles.iconBtnSelected),
                ]}
              >
                <Ionicons name={item.icon} size={item.iconSize ?? 28} color={item.primary ? "#fff" : color} />
                {item.label ? <Text style={styles.controlHint}>{item.label}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.navHint}>{t("player.music_nav_hint")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  topBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  topBtnSelected: { borderColor: colors.brand },
  topBtnText: { color: colors.text, fontSize: 18 },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  mainInner: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: spacing.xl,
    width: "100%",
    maxWidth: 1100,
    flex: 1,
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
  trackTitle: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: spacing.lg, textAlign: "center" },
  trackSub: { color: colors.textSecondary, fontSize: 18, marginTop: 8, textAlign: "center" },
  lyricsPanel: {
    flex: 1,
    minWidth: 0,
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  lyricsContent: {
    flexGrow: 1,
    width: "100%",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  lyricLine: {
    width: "100%",
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: LYRIC_LINE_HEIGHT,
    textAlign: "center",
  },
  lyricActive: { color: colors.accent, fontSize: 26, fontWeight: "700" },
  lyricPast: { color: colors.textSecondary },
  noLyricsWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  noLyrics: { color: colors.textMuted, fontSize: 20, textAlign: "center" },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  timeText: { color: colors.textSecondary, fontSize: 16, textAlign: "center" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, marginTop: spacing.sm },
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  iconBtnSelected: { borderColor: colors.brand, backgroundColor: "rgba(255,255,255,0.08)" },
  playBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  playBtnSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  iconBtnDisabled: { opacity: 0.45 },
  controlHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  navHint: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: spacing.sm },
});

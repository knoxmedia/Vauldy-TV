import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { colors, radius, spacing } from "@/constants/theme";
import { registerTvKeyHandler, consumeTvKeyEvent, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { t } from "@/i18n";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type ControlItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  label?: string;
  onPress: () => void;
  primary?: boolean;
};

type FocusZone = "back" | "progress" | "controls";

type Props = {
  visible: boolean;
  title: string;
  playing: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onSeekBy: (deltaSec: number) => void;
  onStop: () => void;
  onBack: () => void;
  onInteraction: () => void;
};

export default function TvVideoPlayerOverlay({
  visible,
  title,
  playing,
  position,
  duration,
  onTogglePlay,
  onSeekBy,
  onStop,
  onBack,
  onInteraction,
}: Props) {
  const isFocused = useIsFocused();
  const [zone, setZone] = useState<FocusZone>("progress");
  const [controlIndex, setControlIndex] = useState(0);

  const controls = useMemo<ControlItem[]>(
    () => [
      {
        key: "rewind",
        icon: "play-back",
        iconSize: 28,
        label: "30s",
        onPress: () => onSeekBy(-30),
      },
      {
        key: "play",
        icon: playing ? "pause" : "play",
        iconSize: 36,
        onPress: onTogglePlay,
        primary: true,
      },
      {
        key: "forward",
        icon: "play-forward",
        iconSize: 28,
        label: "30s",
        onPress: () => onSeekBy(30),
      },
      {
        key: "stop",
        icon: "stop",
        iconSize: 26,
        label: t("player.stop"),
        onPress: onStop,
      },
    ],
    [onSeekBy, onStop, onTogglePlay, playing],
  );

  useEffect(() => {
    if (visible) {
      setZone("progress");
      setControlIndex(0);
    }
  }, [visible]);

  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const controlIndexRef = useRef(controlIndex);
  controlIndexRef.current = controlIndex;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  useEffect(() => {
    const handler = (evt: TvKeyEvent) => {
      if (!isFocused || !visible) return;
      const type = evt.eventType;
      if (type === "focus" || type === "blur") return;
      consumeTvKeyEvent(evt);
      onInteraction();

      const z = zoneRef.current;
      const ci = controlIndexRef.current;

      if (type === "select") {
        if (z === "back") {
          onBack();
          return;
        }
        if (z === "progress") {
          onTogglePlay();
          return;
        }
        controlsRef.current[ci]?.onPress();
        return;
      }

      if (z === "back") {
        if (type === "down") setZone("progress");
        return;
      }

      if (z === "progress") {
        if (type === "left" || type === "longLeft") {
          onSeekBy(type === "longLeft" ? -60 : -30);
          return;
        }
        if (type === "right" || type === "longRight") {
          onSeekBy(type === "longRight" ? 60 : 30);
          return;
        }
        if (type === "up") {
          setZone("back");
          return;
        }
        if (type === "down") {
          setZone("controls");
          setControlIndex(0);
        }
        return;
      }

      // controls zone
      if (type === "up") {
        setZone("progress");
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
  }, [isFocused, visible, onInteraction, onBack, onTogglePlay, onSeekBy]);

  if (!visible) return null;

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.topBar}>
        <Pressable
          focusable={false}
          onPress={onBack}
          style={[styles.backBtn, zone === "back" && styles.backBtnSelected]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.bottom}>
        <View style={[styles.progressTrack, zone === "progress" && styles.progressTrackSelected]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.timeText}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
        <View style={styles.controls}>
          {controls.map((item, index) => {
            const selected = zone === "controls" && controlIndex === index;
            return (
              <Pressable
                key={item.key}
                focusable={false}
                onPress={item.onPress}
                style={[
                  item.primary ? styles.playBtn : styles.iconBtn,
                  selected && (item.primary ? styles.playBtnSelected : styles.iconBtnSelected),
                ]}
              >
                <Ionicons name={item.icon} size={item.iconSize ?? 24} color={item.primary ? "#fff" : colors.text} />
                {item.label ? <Text style={styles.hint}>{item.label}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helpText}>{t("player.video_nav_hint")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 20,
  },
  topBar: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.overlay,
    borderWidth: 2,
    borderColor: "transparent",
  },
  backBtnSelected: {
    borderColor: colors.brand,
    backgroundColor: "rgba(0,164,220,0.25)",
  },
  backText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  progressTrackSelected: {
    borderColor: colors.brand,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  timeText: { color: colors.text, fontSize: 18, textAlign: "center" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: spacing.sm,
  },
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.overlay,
    borderWidth: 2,
    borderColor: colors.border,
  },
  iconBtnSelected: {
    borderColor: colors.brand,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
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
  playBtnSelected: {
    backgroundColor: colors.accent,
    borderColor: "#fff",
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  helpText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: spacing.sm },
});

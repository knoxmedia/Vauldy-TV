import { useCallback, useEffect, useRef } from "react";
import { BackHandler, Pressable, StyleSheet, Text } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { colors, radius, spacing } from "@/constants/theme";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { registerTvKeyHandler, consumeTvKeyEvent, tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { t } from "@/i18n";
import { useTvFocusStore } from "@/store/tvFocus";

type Props = {
  onPress: () => void;
  preferredFocus?: boolean;
};

export default function TvBackButton({ onPress, preferredFocus }: Props) {
  const isFocused = useIsFocused();
  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const registerBack = useTvFocusStore((s) => s.registerBack);
  const unregisterBack = useTvFocusStore((s) => s.unregisterBack);
  const musicBarVisible = useTvFocusStore((s) => s.musicBarVisible);
  const selected = TV_NAV_ENABLED && isFocused && zone === "back";

  // Refs for stable handler.
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const setZoneRef = useRef(setZone);
  setZoneRef.current = setZone;

  useEffect(() => {
    if (!TV_NAV_ENABLED || !isFocused) return;
    registerBack(onPress);
    return () => unregisterBack(onPress);
  }, [isFocused, onPress, registerBack, unregisterBack]);

  useEffect(() => {
    if (!TV_NAV_ENABLED) return;
    const handler = (evt: TvKeyEvent) => {
      if (!isFocusedRef.current || zoneRef.current !== "back") return;
      const type = tvNavigationEventType(evt.eventType);
      if (type === "select") {
        consumeTvKeyEvent(evt);
        onPressRef.current();
        return;
      }
      if (type === "down" || type === "left") {
        consumeTvKeyEvent(evt);
        setZoneRef.current("content");
        return;
      }
      if (type === "up") {
        consumeTvKeyEvent(evt);
        return;
      }
    };
    return registerTvKeyHandler(handler);
  }, []);

  return (
    <Pressable
      focusable={!TV_NAV_ENABLED}
      hasTVPreferredFocus={TV_NAV_ENABLED ? undefined : preferredFocus}
      onPress={TV_NAV_ENABLED ? undefined : onPress}
      style={({ pressed, focused }) => [
        styles.btn,
        selected && styles.btnSelected,
        !TV_NAV_ENABLED && (pressed || focused) && styles.btnActive,
      ]}
    >
      <Text style={styles.text}>← {t("common.back")}</Text>
    </Pressable>
  );
}

export function useTvBackHandler(onBack: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    borderWidth: 2,
    borderColor: "rgba(237,109,0,0.35)",
    minWidth: 120,
    alignItems: "center",
  },
  btnSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.accentBgStrong,
  },
  btnActive: {
    backgroundColor: colors.accentBgStrong,
    borderColor: colors.accent,
  },
  text: { color: colors.accent, fontSize: 18, fontWeight: "600" },
});

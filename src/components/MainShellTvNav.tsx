import { useRouter, useSegments, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, BackHandler } from "react-native";
import { consumeTvKeyEvent, registerPriorityTvKeyHandler, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { t } from "@/i18n";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { useTvFocusStore } from "@/store/tvFocus";

const NAV: { href: Href; segment: string | null }[] = [
  { href: "/(main)", segment: null },
  { href: "/(main)/browse", segment: "browse" },
  { href: "/(main)/favorites", segment: "favorites" },
  { href: "/(main)/settings", segment: "settings" },
];

function navIndexFromSegments(segments: readonly string[]): number {
  if (segments[0] !== "(main)") return 0;
  const last = segments[segments.length - 1] ?? "(main)";
  if (last === "(main)" || last === "index") return 0;
  for (let i = 1; i < NAV.length; i++) {
    if (NAV[i]!.segment === last) return i;
  }
  return 0;
}

/** Priority TV handler for sidebar + delegated main-tab content navigation. */
export default function MainShellTvNav() {
  const router = useRouter();
  const segments = useSegments();
  const setSidebarIndex = useTvFocusStore((s) => s.setSidebarIndex);

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const routerRef = useRef(router);
  routerRef.current = router;

  // Keep sidebar highlight aligned with the active route.
  useEffect(() => {
    setSidebarIndex(navIndexFromSegments(segments));
  }, [segments, setSidebarIndex]);

  useEffect(() => {
    if (!TV_NAV_ENABLED) return;

    const handler = (evt: TvKeyEvent) => {
      if (segmentsRef.current[0] !== "(main)") return;

      const state = useTvFocusStore.getState();
      const type = evt.eventType;
      if (type === "focus" || type === "blur") return;

      if (state.zone === "sidebar") {
        const cur = state.sidebarIndex;

        if (type === "select") {
          consumeTvKeyEvent(evt);
          const item = NAV[cur];
          if (!item) return;
          routerRef.current.replace(item.href);
          return;
        }
        if (type === "up" && cur > 0) {
          consumeTvKeyEvent(evt);
          state.setSidebarIndex(cur - 1);
          return;
        }
        if (type === "down" && cur < NAV.length - 1) {
          consumeTvKeyEvent(evt);
          state.setSidebarIndex(cur + 1);
          return;
        }
        if (type === "right") {
          consumeTvKeyEvent(evt);
          state.setZone("content");
          return;
        }
        return;
      }

      if (state.zone === "content" && state.contentKeyHandler) {
        if (state.contentKeyHandler(evt)) {
          consumeTvKeyEvent(evt);
        }
      }
    };

    return registerPriorityTvKeyHandler(handler);
  }, []);

  // Hardware back button: move focus from content → sidebar (or back → content).
  // When already in the sidebar, show an exit confirmation dialog.
  useEffect(() => {
    if (!TV_NAV_ENABLED) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const state = useTvFocusStore.getState();
      if (segmentsRef.current[0] !== "(main)") return false;
      if (state.zone === "back") {
        state.setZone("content");
        return true;
      }
      if (state.zone === "content") {
        state.setZone("sidebar");
        return true;
      }
      if (state.zone === "sidebar") {
        Alert.alert(t("app.exit_title"), t("app.exit_message"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("app.exit_confirm"), style: "destructive", onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  return null;
}

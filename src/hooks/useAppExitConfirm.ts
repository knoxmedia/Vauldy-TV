import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, BackHandler } from "react-native";
import { consumeTvKeyEvent, registerTvKeyHandler, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { t } from "@/i18n";
import { exitApp } from "@/lib/exitApp";

function showExitConfirm() {
  Alert.alert(t("app.exit_title"), t("app.exit_message"), [
    { text: t("common.cancel"), style: "cancel" },
    {
      text: t("app.exit_confirm"),
      style: "destructive",
      onPress: () => exitApp(),
    },
  ]);
}

/** Prompt before exiting when hardware back cannot navigate further. */
export function useAppExitConfirm() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (routerRef.current.canGoBack()) return false;
      showExitConfirm();
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!TV_NAV_ENABLED) return;

    const handler = (evt: TvKeyEvent) => {
      if (evt.eventType !== "menu") return;

      const router = routerRef.current;
      if (router.canGoBack()) {
        consumeTvKeyEvent(evt);
        router.back();
        return;
      }

      consumeTvKeyEvent(evt);
      showExitConfirm();
    };

    return registerTvKeyHandler(handler);
  }, []);
}

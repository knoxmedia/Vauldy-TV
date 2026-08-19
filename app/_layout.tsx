import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, StyleSheet, View, useTVEventHandler } from "react-native";
import { setUnauthorizedHandler } from "@/api/client";
import FloatingMusicBar from "@/components/player/FloatingMusicBar";
import GlobalMusicEngine from "@/components/player/GlobalMusicEngine";
import { useAppExitConfirm } from "@/hooks/useAppExitConfirm";
import { dispatchTvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { resolveLocale } from "@/i18n";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";

function useProtectedRoute() {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const serverUrl = useConfigStore((s) => s.serverUrl);

  useEffect(() => {
    setUnauthorizedHandler(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    const inAuth = segments[0] === "login" || segments[0] === "setup";
    if (!serverUrl) {
      if (segments[0] !== "setup") router.replace("/setup");
      return;
    }
    if (!token) {
      if (!inAuth) router.replace("/login");
      return;
    }
    if (inAuth) router.replace("/(main)");
  }, [token, serverUrl, segments, router]);
}

export default function RootLayout() {
  useProtectedRoute();
  useAppExitConfirm();
  const uiLocale = useAuthStore((s) => s.uiLocale);
  const localeKey = uiLocale || resolveLocale();

  // Single global TV event handler — dispatches to all registered useTvRemoteNav instances.
  useTVEventHandler((evt) => {
    dispatchTvKeyEvent(evt);
  });

  return (
    <View key={localeKey} style={styles.root}>
      <StatusBar style="light" />
      {TV_NAV_ENABLED ? (
        <Pressable focusable hasTVPreferredFocus accessible style={styles.tvEventSink} />
      ) : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0f1419" },
          animation: "fade",
        }}
      >
        <Stack.Screen name="setup" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="library/[id]" />
        <Stack.Screen name="series/[id]" />
        <Stack.Screen name="media/[id]" />
        <Stack.Screen name="player/[id]" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="reader/[id]" />
        <Stack.Screen name="photo/[id]" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="about" />
      </Stack>
      <GlobalMusicEngine />
      <FloatingMusicBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tvEventSink: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    left: 0,
    top: 0,
    zIndex: 0,
  },
});

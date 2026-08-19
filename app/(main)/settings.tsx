import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  checkHealth,
  connectionFailureDetail,
  connectionFailureKey,
  fetchBranding,
  logout,
  updateUserProfile,
} from "@/api/client";
import FocusablePressable from "@/components/focus/FocusablePressable";
import TvUrlField from "@/components/focus/TvUrlField";
import { Screen } from "@/components/LoadingState";
import { colors, radius, spacing } from "@/constants/theme";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import { tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { resolveLocale, t, type Locale } from "@/i18n";
import { useAuthStore } from "@/store/auth";
import { normalizeServerUrl, useConfigStore } from "@/store/config";
import { useTvFocusStore } from "@/store/tvFocus";
import packageJson from "../../package.json";

const appVersion = Constants.expoConfig?.version ?? packageJson.version ?? "unknown";
const useScreenKeyboard = Platform.isTV;
const LOCALES: Locale[] = ["zh-CN", "en"];
const TV_ITEM_COUNT = 5;

export default function SettingsScreen() {
  const router = useRouter();
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const setServerUrl = useConfigStore((s) => s.setServerUrl);
  const setAppName = useConfigStore((s) => s.setAppName);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setUiLocale = useAuthStore((s) => s.setUiLocale);
  const uiLocale = useAuthStore((s) => s.uiLocale);
  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const [url, setUrl] = useState(serverUrl || "");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [urlKeyboardOpen, setUrlKeyboardOpen] = useState(false);
  const focusIndexRef = useRef(0);
  const keyboardOpenRef = useRef(false);
  keyboardOpenRef.current = urlKeyboardOpen;
  void uiLocale;

  async function saveServer() {
    const normalized = normalizeServerUrl(url);
    if (!normalized) {
      Alert.alert(t("setup.invalid_url"));
      return;
    }
    setUrl(normalized);
    setSaving(true);
    try {
      const ok = await checkHealth(normalized);
      if (!ok) throw new Error("health");
      setServerUrl(normalized);
      try {
        const branding = await fetchBranding();
        if (branding.app_name) setAppName(branding.app_name);
      } catch {
        /* optional */
      }
      Alert.alert(t("settings.server_saved"));
    } catch (error) {
      setServerUrl(serverUrl);
      setUrl(serverUrl || "");
      const detail = connectionFailureDetail(error);
      Alert.alert(
        t("setup.failure"),
        `${t(connectionFailureKey(error))}\n\n${normalized}${detail ? `\n${detail}` : ""}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function cycleLanguage() {
    const current = resolveLocale();
    const next = LOCALES[(LOCALES.indexOf(current) + 1) % LOCALES.length]!;
    setSavingLocale(true);
    try {
      await updateUserProfile({ ui_locale: next });
    } catch {
      /* apply locally for offline / older servers */
    } finally {
      setUiLocale(next);
      Alert.alert(t("settings.language_saved"));
      setSavingLocale(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      /* ignore */
    } finally {
      clearSession();
      setLoggingOut(false);
      router.replace("/login");
    }
  }

  const moveFocus = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(TV_ITEM_COUNT - 1, next));
    focusIndexRef.current = clamped;
    setFocusIndex(clamped);
  }, []);

  useMainContentNav(
    useCallback((evt: TvKeyEvent) => {
      if (!Platform.isTV || keyboardOpenRef.current) return false;
      const type = tvNavigationEventType(evt.eventType);
      if (type === "up") {
        moveFocus(focusIndexRef.current - 1);
        return true;
      }
      if (type === "down") {
        moveFocus(focusIndexRef.current + 1);
        return true;
      }
      if (type === "left") {
        setZone("sidebar");
        return true;
      }
      if (type === "select") {
        const index = focusIndexRef.current;
        if (index === 0) setUrlKeyboardOpen(true);
        else if (index === 1) void saveServer();
        else if (index === 2) void cycleLanguage();
        else if (index === 3) router.push("/about" as Href);
        else void handleLogout();
        return true;
      }
      return false;
    }, [moveFocus, router, setZone, url]),
  );

  const localeLabel = t(`settings.lang.${resolveLocale()}`);
  const tvStyle = (index: number, style: any) => [style, zone === "content" && focusIndex === index && styles.btnFocused];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
        <Text style={styles.title}>{t("settings.title")}</Text>

        <View style={[styles.card, useScreenKeyboard && styles.cardWide]}>
          <Text style={styles.sectionTitle}>{t("settings.server")}</Text>
          <TvUrlField
            preferredFocus
            value={url}
            onChangeText={setUrl}
            placeholder={t("setup.url_placeholder")}
            onSubmit={() => void saveServer()}
            tvSelected={Platform.isTV && zone === "content" && focusIndex === 0 && !urlKeyboardOpen}
            keyboardOpen={urlKeyboardOpen}
            onKeyboardOpenChange={setUrlKeyboardOpen}
          />
          {Platform.isTV ? (
            <Pressable focusable={false} style={tvStyle(1, styles.primaryBtn)}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("common.save")}</Text>}
            </Pressable>
          ) : (
            <FocusablePressable onPress={() => void saveServer()} style={styles.primaryBtn} focusedStyle={styles.btnFocused}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t("common.save")}</Text>}
            </FocusablePressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          {Platform.isTV ? (
            <Pressable focusable={false} style={tvStyle(2, styles.rowBtn)}>
              {savingLocale ? <ActivityIndicator color={colors.brand} /> : (
                <><Text style={styles.rowLabel}>{t("settings.language")}</Text><Text style={styles.rowValue}>{localeLabel}</Text></>
              )}
            </Pressable>
          ) : (
            <FocusablePressable onPress={() => void cycleLanguage()} style={styles.rowBtn} focusedStyle={styles.btnFocused}>
              <Text style={styles.rowLabel}>{t("settings.language")}</Text><Text style={styles.rowValue}>{localeLabel}</Text>
            </FocusablePressable>
          )}
          {Platform.isTV ? (
            <Pressable focusable={false} style={tvStyle(3, [styles.rowBtn, styles.rowBtnSpaced])}>
              <Text style={styles.rowLabel}>{t("settings.about")}</Text><Text style={styles.rowValue}>{">"}</Text>
            </Pressable>
          ) : (
            <FocusablePressable onPress={() => router.push("/about" as Href)} style={[styles.rowBtn, styles.rowBtnSpaced]} focusedStyle={styles.btnFocused}>
              <Text style={styles.rowLabel}>{t("settings.about")}</Text><Text style={styles.rowValue}>{">"}</Text>
            </FocusablePressable>
          )}
        </View>

        <View style={styles.card}>
          {Platform.isTV ? (
            <Pressable focusable={false} style={tvStyle(4, styles.secondaryBtn)}>
              {loggingOut ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.secondaryText}>{t("settings.logout")}</Text>}
            </Pressable>
          ) : (
            <FocusablePressable onPress={() => void handleLogout()} style={styles.secondaryBtn} focusedStyle={styles.btnFocused}>
              <Text style={styles.secondaryText}>{t("settings.logout")}</Text>
            </FocusablePressable>
          )}
          <Text style={styles.version}>{t("settings.version", { version: appVersion })}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  title: { color: colors.text, fontSize: 32, fontWeight: "700", marginBottom: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  cardWide: { maxWidth: 820 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "600", marginBottom: spacing.md },
  primaryBtn: { marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 2, borderColor: "transparent" },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  rowBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.inputBg, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2, borderColor: colors.borderLight, minHeight: 52 },
  rowBtnSpaced: { marginTop: spacing.md },
  rowLabel: { color: colors.text, fontSize: 18, fontWeight: "600" },
  rowValue: { color: colors.brand, fontSize: 18, fontWeight: "600" },
  secondaryBtn: { backgroundColor: colors.accentBg, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 2, borderColor: "rgba(237,109,0,0.25)" },
  secondaryText: { color: colors.accent, fontSize: 18, fontWeight: "600" },
  btnFocused: { borderColor: colors.brand },
  version: { color: colors.textMuted, fontSize: 14, marginTop: spacing.md, textAlign: "center" },
});

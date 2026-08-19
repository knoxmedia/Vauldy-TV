import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  checkHealth,
  connectionFailureDetail,
  connectionFailureKey,
  fetchBranding,
} from "@/api/client";
import FocusablePressable from "@/components/focus/FocusablePressable";
import TvUrlField from "@/components/focus/TvUrlField";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { normalizeServerUrl, useConfigStore } from "@/store/config";

const useScreenKeyboard = Platform.OS === "android" || Platform.isTV;

export default function SetupScreen() {
  const router = useRouter();
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const setServerUrl = useConfigStore((s) => s.setServerUrl);
  const setAppName = useConfigStore((s) => s.setAppName);
  const defaultUrl =
    serverUrl || (Platform.OS === "android" && __DEV__ ? "http://10.0.2.2:8200" : "");
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);

  async function connect() {
    const normalized = normalizeServerUrl(url);
    if (!normalized) {
      Alert.alert(t("setup.invalid_url"));
      return;
    }
    setUrl(normalized);
    setLoading(true);
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
      router.replace("/login");
    } catch (error) {
      setServerUrl(null);
      const detail = connectionFailureDetail(error);
      Alert.alert(
        t("setup.failure"),
        `${t(connectionFailureKey(error))}\n\n${normalized}${detail ? `\n${detail}` : ""}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={["#0f1419", "#1a2332"]} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
        <View style={[styles.card, useScreenKeyboard && styles.cardWide]}>
          <Text style={styles.title}>{t("setup.title")}</Text>
          <Text style={styles.subtitle}>{t("setup.subtitle")}</Text>
          <Text style={styles.label}>{t("setup.url")}</Text>
          <TvUrlField
            preferredFocus
            value={url}
            onChangeText={setUrl}
            placeholder={t("setup.url_placeholder")}
            onSubmit={() => void connect()}
          />
          <FocusablePressable onPress={() => void connect()} style={styles.button} focusedStyle={styles.buttonFocused}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("setup.continue")}</Text>}
          </FocusablePressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  card: {
    width: 560,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWide: { width: 720, maxWidth: "100%" },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, marginTop: 12, marginBottom: 28, lineHeight: 24, fontSize: 18 },
  label: { color: colors.textSecondary, fontSize: 16, marginBottom: 10 },
  button: {
    marginTop: 24,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonFocused: {},
  buttonText: { color: "#fff", fontSize: 20, fontWeight: "600" },
});

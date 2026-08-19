import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TvBackButton, { useTvBackHandler } from "@/components/focus/TvBackButton";
import { Screen } from "@/components/LoadingState";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { useConfigStore } from "@/store/config";
import { useTvFocusStore } from "@/store/tvFocus";
import packageJson from "../package.json";

const appVersion = Constants.expoConfig?.version ?? packageJson.version ?? "unknown";

export default function AboutScreen() {
  const router = useRouter();
  const serverUrl = useConfigStore((s) => s.serverUrl);
  const appName = useConfigStore((s) => s.appName);
  const setZone = useTvFocusStore((s) => s.setZone);
  const goBack = useCallback(() => router.back(), [router]);
  useTvBackHandler(goBack);

  useFocusEffect(
    useCallback(() => {
      setZone("back");
    }, [setZone]),
  );

  const rn = Platform.constants?.reactNativeVersion;
  const runtime = rn
    ? `react-native-tvos ${rn.major}.${rn.minor}.${rn.patch}`
    : "react-native-tvos";
  const platformLabel = Platform.isTV
    ? Platform.OS === "ios"
      ? "Apple TV (tvOS)"
      : "Android TV"
    : Platform.OS;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TvBackButton onPress={goBack} preferredFocus />
        </View>
        <Text style={styles.title}>{t("settings.about_title")}</Text>
        <View style={styles.card}>
          <Row label={t("settings.about_app")} value={appName || "Vauldy TV"} />
          <Row label={t("settings.about_version")} value={appVersion} />
          <Row label={t("settings.about_runtime")} value={runtime || "react-native-tvos"} />
          <Row label={t("settings.about_platform")} value={String(platformLabel)} />
          <Row label={t("settings.about_server")} value={serverUrl || "—"} last />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? undefined : styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  topBar: { marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 32, fontWeight: "700", marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.textSecondary, fontSize: 16, marginBottom: 6 },
  value: { color: colors.text, fontSize: 20, fontWeight: "600" },
});

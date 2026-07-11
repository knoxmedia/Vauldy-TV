import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchUserInfo, login } from "@/api/client";
import FocusablePressable from "@/components/focus/FocusablePressable";
import TvOnScreenKeyboard from "@/components/focus/TvOnScreenKeyboard";
import TvTextInput from "@/components/focus/TvTextInput";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";

const useScreenKeyboard = Platform.OS === "android" || Platform.isTV;

type EditField = "username" | "password" | null;

export default function LoginScreen() {
  const router = useRouter();
  const appName = useConfigStore((s) => s.appName);
  const setToken = useAuthStore((s) => s.setToken);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [editField, setEditField] = useState<EditField>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setEditField(null);
    setLoading(true);
    try {
      const token = await login(username, password);
      setToken(token);
      const info = await fetchUserInfo();
      setProfile(info.username, info.role, {
        canPlay: info.can_play,
        avatarUrl: info.avatar_url,
        uiLocale: info.ui_locale,
      });
      router.replace("/(main)");
    } catch {
      useAuthStore.getState().clearSession();
      Alert.alert(t("login.failure"));
    } finally {
      setLoading(false);
    }
  }

  const keyboardOpen = editField !== null;

  return (
    <LinearGradient colors={["#0f1419", "#1a2332"]} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
        <View style={[styles.card, useScreenKeyboard && styles.cardWide]}>
          <Text style={styles.title}>{t("login.title", { appName })}</Text>
          <Text style={styles.subtitle}>{t("login.subtitle")}</Text>

          <Text style={styles.label}>{t("login.username")}</Text>
          {useScreenKeyboard ? (
            <FocusablePressable
              preferredFocus={!keyboardOpen}
              onPress={() => setEditField("username")}
              style={[styles.fieldDisplay, editField === "username" && styles.fieldActive]}
              focusedStyle={styles.fieldFocused}
            >
              <Text style={[styles.fieldText, !username && styles.placeholder]} numberOfLines={1}>
                {username || t("login.username")}
              </Text>
              {editField !== "username" ? <Text style={styles.tapHint}>{t("keyboard.tap_to_edit")}</Text> : null}
            </FocusablePressable>
          ) : (
            <TvTextInput
              preferredFocus
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <Text style={styles.label}>{t("login.password")}</Text>
          {useScreenKeyboard ? (
            <FocusablePressable
              onPress={() => setEditField("password")}
              style={[styles.fieldDisplay, editField === "password" && styles.fieldActive]}
              focusedStyle={styles.fieldFocused}
            >
              <Text style={[styles.fieldText, styles.passwordText, !password && styles.placeholder]} numberOfLines={1}>
                {password ? "•".repeat(Math.min(password.length, 24)) : t("login.password_placeholder")}
              </Text>
              {editField !== "password" ? <Text style={styles.tapHint}>{t("keyboard.tap_to_edit")}</Text> : null}
            </FocusablePressable>
          ) : (
            <TvTextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
          )}

          {useScreenKeyboard ? (
            <FocusablePressable onPress={() => setPassword("admin123")} style={styles.demoFill} focusedStyle={styles.demoFillFocused}>
              <Text style={styles.demoFillText}>{t("login.fill_demo_password")}</Text>
            </FocusablePressable>
          ) : null}

          {keyboardOpen ? (
            <TvOnScreenKeyboard
              preferredFocus
              value={editField === "password" ? password : username}
              onChangeText={editField === "password" ? setPassword : setUsername}
              onDone={() => setEditField(null)}
            />
          ) : null}

          <Text style={styles.hint}>{t("login.demo_hint")}</Text>
          <FocusablePressable onPress={() => void submit()} style={styles.button} focusedStyle={styles.buttonFocused}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("login.submit")}</Text>}
          </FocusablePressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: spacing.xl, paddingTop: 48, flexGrow: 1, justifyContent: "center" },
  card: {
    width: 560,
    alignSelf: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWide: { width: 720, maxWidth: "100%" },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, marginTop: 12, marginBottom: 28, fontSize: 18 },
  label: { color: colors.textSecondary, fontSize: 16, marginBottom: 10, marginTop: 12 },
  fieldDisplay: {
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    justifyContent: "center",
  },
  fieldFocused: {
    borderColor: colors.brand,
  },
  fieldActive: {
    borderColor: colors.accent,
  },
  fieldText: { color: colors.text, fontSize: 22 },
  passwordText: { letterSpacing: 3 },
  placeholder: { color: colors.textMuted },
  tapHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  demoFill: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  demoFillFocused: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  demoFillText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  hint: { color: colors.textMuted, marginTop: 16, fontSize: 14 },
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

import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import FocusablePressable from "@/components/focus/FocusablePressable";
import TvOnScreenKeyboard from "@/components/focus/TvOnScreenKeyboard";
import TvTextInput from "@/components/focus/TvTextInput";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";

const useScreenKeyboard = Platform.OS === "android" || Platform.isTV;

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  preferredFocus?: boolean;
  onSubmit?: () => void;
};

export default function TvUrlField({ value, onChangeText, placeholder, preferredFocus, onSubmit }: Props) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  if (!useScreenKeyboard) {
    return (
      <TvTextInput
        preferredFocus={preferredFocus}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        keyboardType="url"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <FocusablePressable
        preferredFocus={preferredFocus && !keyboardOpen}
        onPress={() => setKeyboardOpen(true)}
        style={[styles.display, keyboardOpen && styles.displayActive]}
        focusedStyle={styles.displayFocused}
      >
        <Text style={[styles.displayText, !value && styles.placeholder]} numberOfLines={2}>
          {value || placeholder || ""}
        </Text>
        {!keyboardOpen ? <Text style={styles.tapHint}>{t("keyboard.tap_to_edit")}</Text> : null}
      </FocusablePressable>
      {keyboardOpen ? (
        <TvOnScreenKeyboard
          variant="url"
          value={value}
          onChangeText={onChangeText}
          preferredFocus
          onDone={() => setKeyboardOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  display: {
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    justifyContent: "center",
  },
  displayFocused: {
    borderColor: colors.brand,
  },
  displayActive: {
    borderColor: colors.accent,
  },
  displayText: { color: colors.text, fontSize: 18 },
  placeholder: { color: colors.textMuted },
  tapHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

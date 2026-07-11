import { StyleSheet, Text, View } from "react-native";
import FocusablePressable from "@/components/focus/FocusablePressable";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";

const ROWS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;
const URL_ROW = [":", "/", ".", "-", "_"] as const;

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Called when user confirms (确定) — typically hide the keyboard. */
  onDone?: () => void;
  variant?: "default" | "url";
  preferredFocus?: boolean;
};

function Key({
  label,
  onPress,
  wide,
  accent,
  preferredFocus,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  accent?: boolean;
  preferredFocus?: boolean;
}) {
  return (
    <FocusablePressable
      preferredFocus={preferredFocus}
      onPress={onPress}
      style={[wide ? styles.wideKey : styles.key, accent && styles.doneKey]}
      focusedStyle={styles.keyFocused}
    >
      <Text style={accent ? styles.doneText : styles.keyText}>{label}</Text>
    </FocusablePressable>
  );
}

export default function TvOnScreenKeyboard({
  value,
  onChangeText,
  onDone,
  variant = "default",
  preferredFocus,
}: Props) {
  const hint = variant === "url" ? t("setup.keyboard_hint") : t("login.keyboard_hint");
  let keyIndex = 0;

  function renderKey(label: string, onPress: () => void, opts?: { wide?: boolean; accent?: boolean }) {
    const index = keyIndex++;
    return (
      <Key
        key={`${label}-${index}`}
        label={label}
        onPress={onPress}
        wide={opts?.wide}
        accent={opts?.accent}
        preferredFocus={preferredFocus && index === 0}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{hint}</Text>
      {ROWS.map((row) => (
        <View key={row} style={styles.row}>
          {row.split("").map((char) => renderKey(char, () => onChangeText(value + char)))}
        </View>
      ))}
      {variant === "url" ? (
        <>
          <View style={styles.row}>
            {URL_ROW.map((char) => renderKey(char, () => onChangeText(value + char)))}
          </View>
          <View style={styles.row}>
            {renderKey("http://", () => onChangeText(value || "http://"), { wide: true })}
            {renderKey("https://", () => onChangeText(value || "https://"), { wide: true })}
          </View>
        </>
      ) : null}
      <View style={styles.row}>
        {renderKey(t("keyboard.backspace"), () => onChangeText(value.slice(0, -1)), { wide: true })}
        {renderKey(t("keyboard.clear"), () => onChangeText(""), { wide: true })}
        {onDone ? renderKey(t("keyboard.done"), onDone, { wide: true, accent: true }) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    width: "100%",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  key: {
    minWidth: 52,
    height: 48,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  wideKey: {
    minWidth: 120,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  keyFocused: {
    backgroundColor: colors.borderLight,
    borderColor: colors.brand,
  },
  doneKey: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  keyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  doneText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});

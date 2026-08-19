import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import FocusablePressable from "@/components/focus/FocusablePressable";
import { colors, radius, spacing } from "@/constants/theme";
import {
  consumeTvKeyEvent,
  registerTvKeyHandler,
  tvNavigationEventType,
  type TvKeyEvent,
} from "@/hooks/tvKeyDispatcher";
import { t } from "@/i18n";

const CHAR_ROWS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;
const URL_ROW = [":", "/", ".", "-", "_"] as const;

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Called when user confirms (??) ? typically hide the keyboard. */
  onDone?: () => void;
  variant?: "default" | "url";
  preferredFocus?: boolean;
};

type KeyboardKey = {
  id: string;
  label: string;
  run: () => void;
  wide?: boolean;
  accent?: boolean;
};

function NativeKey({ keyDef, preferredFocus }: { keyDef: KeyboardKey; preferredFocus?: boolean }) {
  return (
    <FocusablePressable
      preferredFocus={preferredFocus}
      onPress={keyDef.run}
      style={[keyDef.wide ? styles.wideKey : styles.key, keyDef.accent && styles.doneKey]}
      focusedStyle={styles.keyFocused}
    >
      <Text style={keyDef.accent ? styles.doneText : styles.keyText}>{keyDef.label}</Text>
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
  const isFocused = useIsFocused();
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeTextRef = useRef(onChangeText);
  onChangeTextRef.current = onChangeText;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const rows = useMemo<KeyboardKey[][]>(() => {
    const charRows: KeyboardKey[][] = CHAR_ROWS.map((chars, row) =>
      chars.split("").map((char, col) => ({
        id: `char-${row}-${col}`,
        label: char,
        run: () => onChangeTextRef.current(valueRef.current + char),
      })),
    );
    const result = [...charRows];
    if (variant === "url") {
      result.push(
        URL_ROW.map((char, col) => ({
          id: `url-${col}`,
          label: char,
          run: () => onChangeTextRef.current(valueRef.current + char),
        })),
      );
      result.push([
        {
          id: "http",
          label: "http://",
          wide: true,
          run: () => onChangeTextRef.current(`http://${valueRef.current.replace(/^https?:\/\//i, "")}`),
        },
        {
          id: "https",
          label: "https://",
          wide: true,
          run: () => onChangeTextRef.current(`https://${valueRef.current.replace(/^https?:\/\//i, "")}`),
        },
      ]);
    }
    const actions: KeyboardKey[] = [
      {
        id: "backspace",
        label: t("keyboard.backspace"),
        wide: true,
        run: () => onChangeTextRef.current(valueRef.current.slice(0, -1)),
      },
      { id: "clear", label: t("keyboard.clear"), wide: true, run: () => onChangeTextRef.current("") },
    ];
    if (onDone) actions.push({ id: "done", label: t("keyboard.done"), wide: true, accent: true, run: () => onDoneRef.current?.() });
    result.push(actions);
    return result;
  }, [variant]);

  const [rowIndex, setRowIndex] = useState(0);
  const [columnIndex, setColumnIndex] = useState(0);
  const rowRef = useRef(0);
  const columnRef = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  useEffect(() => {
    rowRef.current = 0;
    columnRef.current = 0;
    setRowIndex(0);
    setColumnIndex(0);
  }, [variant]);

  useEffect(() => {
    if (!Platform.isTV) return;
    const handler = (evt: TvKeyEvent) => {
      if (!isFocusedRef.current) return;
      const type = tvNavigationEventType(evt.eventType);
      if (type === "focus" || type === "blur") return;
      const currentRows = rowsRef.current;
      const row = rowRef.current;
      const col = columnRef.current;
      if (!currentRows[row]) return;

      if (type === "select") {
        consumeTvKeyEvent(evt);
        currentRows[row]?.[col]?.run();
        return;
      }
      if (type === "left") {
        consumeTvKeyEvent(evt);
        const next = Math.max(0, col - 1);
        columnRef.current = next;
        setColumnIndex(next);
        return;
      }
      if (type === "right") {
        consumeTvKeyEvent(evt);
        const next = Math.min((currentRows[row]?.length ?? 1) - 1, col + 1);
        columnRef.current = next;
        setColumnIndex(next);
        return;
      }
      if (type === "up" || type === "down") {
        consumeTvKeyEvent(evt);
        const nextRow = Math.max(0, Math.min(currentRows.length - 1, row + (type === "up" ? -1 : 1)));
        const nextCol = Math.min(col, (currentRows[nextRow]?.length ?? 1) - 1);
        rowRef.current = nextRow;
        columnRef.current = nextCol;
        setRowIndex(nextRow);
        setColumnIndex(nextCol);
      }
    };
    return registerTvKeyHandler(handler);
  }, []);

  const hint = variant === "url" ? t("setup.keyboard_hint") : t("login.keyboard_hint");

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{hint}</Text>
      {rows.map((row, rowNumber) => (
        <View key={`row-${rowNumber}`} style={styles.row}>
          {row.map((keyDef, columnNumber) => {
            if (!Platform.isTV) {
              return <NativeKey key={keyDef.id} keyDef={keyDef} preferredFocus={preferredFocus && rowNumber === 0 && columnNumber === 0} />;
            }
            const selected = rowIndex === rowNumber && columnIndex === columnNumber;
            return (
              <Pressable
                key={keyDef.id}
                focusable={false}
                style={[
                  keyDef.wide ? styles.wideKey : styles.key,
                  keyDef.accent && styles.doneKey,
                  selected && styles.keyFocused,
                ]}
              >
                <Text style={keyDef.accent ? styles.doneText : styles.keyText}>{keyDef.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, width: "100%" },
  hint: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.md, textAlign: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 8 },
  key: {
    minWidth: 52,
    height: 48,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
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
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  keyFocused: { backgroundColor: colors.borderLight, borderColor: colors.brand },
  doneKey: { backgroundColor: colors.brand, borderColor: colors.brand },
  keyText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  doneText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});

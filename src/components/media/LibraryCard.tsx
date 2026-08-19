import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import FocusablePressable from "@/components/focus/FocusablePressable";
import { colors, libGradient, radius, spacing } from "@/constants/theme";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { libraryTypeLabel } from "@/lib/library";
import { absoluteUrl } from "@/lib/mediaUrl";
import { t } from "@/i18n";
import type { Library } from "@/api/types";

type Props = {
  library: Library;
  onPress: () => void;
  preferredFocus?: boolean;
  onFocus?: () => void;
  tvSelected?: boolean;
};

export default function LibraryCard({ library, onPress, preferredFocus, onFocus, tvSelected }: Props) {
  const [c1, c2, c3] = libGradient(library.type, library.id);
  const preview = library.preview_url ? absoluteUrl(library.preview_url) : null;

  const useRemoteNav = TV_NAV_ENABLED && tvSelected !== undefined;

  const body = (
    <>
      <LinearGradient colors={[c1, c2, c3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
        {preview ? <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" /> : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{libraryTypeLabel(library.type, t)}</Text>
        </View>
      </LinearGradient>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {library.name}
        </Text>
        <Text style={styles.count}>{t("library.media_count", { count: library.media_count ?? 0 })}</Text>
      </View>
    </>
  );

  if (useRemoteNav) {
    return (
      <Pressable focusable={false} style={[styles.card, tvSelected && styles.cardSelected]}>
        {body}
      </Pressable>
    );
  }

  return (
    <FocusablePressable onPress={onPress} preferredFocus={preferredFocus} onFocus={onFocus} style={styles.card} focusedStyle={styles.focused}>
      {body}
    </FocusablePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  cardSelected: { borderColor: colors.brand, borderWidth: 3 },
  focused: {},
  focusRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    zIndex: 2,
  },
  cover: { height: 160, justifyContent: "flex-end" },
  preview: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  badge: {
    alignSelf: "flex-start",
    margin: spacing.sm,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  badgeText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  meta: { padding: spacing.md, gap: 6 },
  name: { color: colors.text, fontSize: 20, fontWeight: "600" },
  count: { color: colors.textSecondary, fontSize: 14 },
});

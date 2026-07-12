import { useRouter, useSegments, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { useConfigStore } from "@/store/config";
import { useTvFocusStore } from "@/store/tvFocus";

const NAV: { href: Href; labelKey: string; segment: string | null }[] = [
  { href: "/(main)", labelKey: "tab.home", segment: null },
  { href: "/(main)/browse", labelKey: "tab.browse", segment: "browse" },
  { href: "/(main)/favorites", labelKey: "tab.favorites", segment: "favorites" },
  { href: "/(main)/settings", labelKey: "tab.settings", segment: "settings" },
];

function routeActiveIndex(segments: readonly string[]): number {
  if (segments[0] !== "(main)") return 0;
  const last = segments[segments.length - 1] ?? "(main)";
  if (last === "(main)" || last === "index") return 0;
  for (let i = 1; i < NAV.length; i++) {
    if (NAV[i]!.segment === last) return i;
  }
  return 0;
}

export default function Sidebar() {
  const router = useRouter();
  const segments = useSegments();
  const appName = useConfigStore((s) => s.appName);
  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const sidebarIndex = useTvFocusStore((s) => s.sidebarIndex);

  const routeIndex = routeActiveIndex(segments);
  const inSidebar = zone === "sidebar";

  const navigateTo = (i: number) => {
    const item = NAV[i];
    if (!item) return;
    router.replace(item.href);
  };

  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>{appName}</Text>
      <View style={styles.nav}>
        {NAV.map((item, index) => {
          // When in sidebar zone, highlight follows the D-pad focus.
          // Otherwise highlight follows the active route.
          const active = inSidebar ? sidebarIndex === index : routeIndex === index;
          return (
            <Pressable
              key={String(item.href)}
              focusable={!TV_NAV_ENABLED}
              onPress={() => navigateTo(index)}
              style={[
                styles.navItem,
                active ? styles.navItemActive : undefined,
              ]}
            >
              <Text style={[styles.navText, active ? styles.navTextActive : undefined]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: colors.header,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  brand: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  nav: { gap: 8 },
  navItem: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  navItemActive: { backgroundColor: "rgba(0,164,220,0.22)", borderColor: colors.brand },
  navText: { color: colors.textSecondary, fontSize: 20, fontWeight: "600" },
  navTextActive: { color: colors.brand },
});

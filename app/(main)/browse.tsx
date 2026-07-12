import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchLibraries } from "@/api/client";
import type { Library } from "@/api/types";
import EmptyState from "@/components/EmptyState";
import HorizontalShelf from "@/components/focus/HorizontalShelf";
import LoadingState, { Screen } from "@/components/LoadingState";
import LibraryCard from "@/components/media/LibraryCard";
import { colors, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import type { TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { useMusicPlayerStore } from "@/store/musicPlayer";
import { useTvFocusStore } from "@/store/tvFocus";

export default function BrowseScreen() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);

  const [itemIndex, setItemIndex] = useState(0);

  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;
  const itemIndexRef = useRef(itemIndex);
  itemIndexRef.current = itemIndex;
  const routerRef = useRef(router);
  routerRef.current = router;
  const setZoneRef = useRef(setZone);
  setZoneRef.current = setZone;

  // Render-confirmed ref — updated ONLY by React render.
  const itemIndexConfirmed = useRef(itemIndex);
  itemIndexConfirmed.current = itemIndex;

  useFocusEffect(
    useCallback(() => {
      setZone("content");
      setItemIndex(0);
      itemIndexRef.current = 0;
    }, [setZone]),
  );

  useEffect(() => {
    fetchLibraries()
      .then((libs) => setLibraries(libs.filter((l) => l.enabled !== 0)))
      .catch(() => setLibraries([]))
      .finally(() => setLoading(false));
  }, []);

  useMainContentNav(
    useCallback((evt: TvKeyEvent) => {
      const type = evt.eventType;
      if (type === "focus" || type === "blur") return false;

      const count = librariesRef.current.length;
      if (count === 0) return false;

      if (type === "select") {
        const lib = librariesRef.current[itemIndexConfirmed.current];
        if (lib) {
          useMusicPlayerStore.getState().setLyricsExpanded(false);
          setZoneRef.current("content");
          routerRef.current.push(`/library/${lib.id}`);
        }
        return true;
      }
      if (type === "left") {
        if (itemIndexRef.current > 0) {
          const next = itemIndexRef.current - 1;
          itemIndexRef.current = next;
          setItemIndex(next);
        } else {
          setZoneRef.current("sidebar");
        }
        return true;
      }
      if (type === "right") {
        if (itemIndexRef.current < count - 1) {
          const next = itemIndexRef.current + 1;
          itemIndexRef.current = next;
          setItemIndex(next);
        }
        return true;
      }
      return false;
    }, []),
  );

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("browse.title")}</Text>
        {libraries.length === 0 ? (
          <EmptyState />
        ) : (
          <HorizontalShelf
            title={t("home.libraries")}
            data={libraries}
            focusIndex={zone === "content" ? itemIndex : -1}
            keyExtractor={(lib) => String(lib.id)}
            renderItem={(lib, _i, { selected }) => (
              <LibraryCard library={lib} tvSelected={selected} onPress={() => {
                useMusicPlayerStore.getState().setLyricsExpanded(false);
                setZone("content");
                router.push(`/library/${lib.id}`);
              }} />
            )}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 32, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
});

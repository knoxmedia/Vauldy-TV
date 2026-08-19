import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchUserHistory } from "@/api/client";
import type { HistoryItem, MediaItem } from "@/api/types";
import EmptyState from "@/components/EmptyState";
import HorizontalShelf from "@/components/focus/HorizontalShelf";
import LoadingState, { Screen } from "@/components/LoadingState";
import MediaCard from "@/components/media/MediaCard";
import { colors, spacing } from "@/constants/theme";
import { useMainContentNav } from "@/hooks/useMainContentNav";
import { tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { t } from "@/i18n";
import { groupHistoryItems, type HistoryGroupKey } from "@/lib/historyGroups";
import { ensureCanPlay } from "@/lib/playbackGate";
import { peekContentFocus, saveContentFocus } from "@/store/contentFocus";
import { useTvFocusStore } from "@/store/tvFocus";

const FOCUS_KEY = "history";

function historyToMediaItem(h: HistoryItem): MediaItem {
  return {
    id: h.media_id,
    library_id: h.library_id ?? 0,
    file_id: h.file_id ?? "",
    title: h.title,
    file_path: h.file_path ?? "",
    file_type: h.file_type || "video",
    duration: h.duration,
    width: 0,
    height: 0,
    format: "",
    status: "",
    poster_url: h.poster_url,
    backdrop_url: h.backdrop_url,
    encrypted_asset: h.encrypted_asset,
  };
}

function groupTitle(key: HistoryGroupKey): string {
  if (key === "today") return t("history.today");
  if (key === "week") return t("history.week");
  return t("history.earlier");
}

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const zone = useTvFocusStore((s) => s.zone);
  const setZone = useTvFocusStore((s) => s.setZone);
  const exitContentUp = useTvFocusStore((s) => s.exitContentUp);
  const exitContentDown = useTvFocusStore((s) => s.exitContentDown);

  const groups = useMemo(() => groupHistoryItems(items), [items]);
  const [activeShelf, setActiveShelf] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);

  const activeShelfRef = useRef(activeShelf);
  const itemIndexRef = useRef(itemIndex);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const load = useCallback(async () => {
    try {
      setItems(await fetchUserHistory(100));
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setZone("content");
      const saved = peekContentFocus(FOCUS_KEY);
      setLoading(true);
      load().finally(() => {
        if (saved) {
          activeShelfRef.current = saved.shelf ?? 0;
          itemIndexRef.current = saved.index;
          setActiveShelf(saved.shelf ?? 0);
          setItemIndex(saved.index);
        } else {
          activeShelfRef.current = 0;
          itemIndexRef.current = 0;
          setActiveShelf(0);
          setItemIndex(0);
        }
        setLoading(false);
      });
    }, [load, setZone]),
  );

  useEffect(() => {
    if (groups.length === 0) return;
    if (activeShelfRef.current >= groups.length) {
      activeShelfRef.current = 0;
      itemIndexRef.current = 0;
      setActiveShelf(0);
      setItemIndex(0);
      return;
    }
    const len = groups[activeShelfRef.current]?.items.length ?? 0;
    if (itemIndexRef.current >= len) {
      const next = Math.max(0, len - 1);
      itemIndexRef.current = next;
      setItemIndex(next);
    }
  }, [groups]);

  useMainContentNav(
    useCallback((evt: TvKeyEvent) => {
      const type = tvNavigationEventType(evt.eventType);
      if (type === "focus" || type === "blur") return false;
      const gs = groupsRef.current;
      if (gs.length === 0) return false;

      const shelf = activeShelfRef.current;
      const idx = itemIndexRef.current;
      const data = gs[shelf]?.items ?? [];
      if (data.length === 0) return false;

      if (type === "select") {
        const h = gs[shelf]?.items[idx];
        if (!h) return true;
        if (h.file_type === "video" || !h.file_type) {
          if (!ensureCanPlay()) return true;
          saveContentFocus(FOCUS_KEY, { shelf, index: idx });
          const tParam = h.position > 0 ? `?t=${Math.floor(h.position)}` : "";
          router.push(`/player/${h.media_id}${tParam}`);
        } else {
          saveContentFocus(FOCUS_KEY, { shelf, index: idx });
          router.push(`/media/${h.media_id}`);
        }
        return true;
      }

      const curShelf = activeShelfRef.current;
      const curData = gs[curShelf]?.items ?? [];

      if (type === "left") {
        if (itemIndexRef.current > 0) {
          const next = itemIndexRef.current - 1;
          itemIndexRef.current = next;
          setItemIndex(next);
        } else {
          setZone("sidebar");
        }
        return true;
      }
      if (type === "right") {
        if (itemIndexRef.current < curData.length - 1) {
          const next = itemIndexRef.current + 1;
          itemIndexRef.current = next;
          setItemIndex(next);
        }
        return true;
      }
      if (type === "up") {
        if (curShelf > 0) {
          const nextShelf = curShelf - 1;
          activeShelfRef.current = nextShelf;
          setActiveShelf(nextShelf);
          const nextIdx = Math.min(itemIndexRef.current, (gs[nextShelf]?.items.length ?? 1) - 1);
          itemIndexRef.current = nextIdx;
          setItemIndex(nextIdx);
        } else {
          exitContentUp();
        }
        return true;
      }
      if (type === "down") {
        if (curShelf < gs.length - 1) {
          const nextShelf = curShelf + 1;
          activeShelfRef.current = nextShelf;
          setActiveShelf(nextShelf);
          const nextIdx = Math.min(itemIndexRef.current, (gs[nextShelf]?.items.length ?? 1) - 1);
          itemIndexRef.current = nextIdx;
          setItemIndex(nextIdx);
        } else {
          exitContentDown();
        }
        return true;
      }
      return false;
    }, [exitContentDown, exitContentUp, router, setZone]),
  );

  if (loading) return <LoadingState />;
  if (groups.length === 0) {
    return (
      <Screen>
        <Text style={styles.title}>{t("history.title")}</Text>
        <EmptyState />
        <Text style={styles.emptyHint}>{t("history.empty")}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("history.title")}</Text>
        {groups.map((group, shelfIdx) => (
          <HorizontalShelf
            key={group.key}
            title={groupTitle(group.key)}
            data={group.items}
            focusIndex={zone === "content" && activeShelf === shelfIdx ? itemIndex : -1}
            keyExtractor={(h, i) => `${group.key}-${h.media_id}-${i}`}
            renderItem={(h, i, { selected }) => (
              <MediaCard
                item={historyToMediaItem(h)}
                aspect="landscape"
                progress={h.duration > 0 ? (h.position / h.duration) * 100 : 0}
                tvSelected={selected}
                onPress={() => {
                  saveContentFocus(FOCUS_KEY, { shelf: shelfIdx, index: i });
                  if (h.file_type === "video" || !h.file_type) {
                    if (!ensureCanPlay()) return;
                    const tParam = h.position > 0 ? `?t=${Math.floor(h.position)}` : "";
                    router.push(`/player/${h.media_id}${tParam}`);
                    return;
                  }
                  router.push(`/media/${h.media_id}`);
                }}
              />
            )}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120, paddingTop: spacing.lg },
  title: { color: colors.text, fontSize: 32, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  emptyHint: { color: colors.textSecondary, fontSize: 16, textAlign: "center", paddingHorizontal: spacing.lg },
});

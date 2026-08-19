import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useIsFocused } from "@react-navigation/native";
import { fetchMedia, fetchMediaDetail } from "@/api/client";
import type { MediaDetail, MediaItem } from "@/api/types";
import { useTvBackHandler } from "@/components/focus/TvBackButton";
import LoadingState from "@/components/LoadingState";
import { consumeTvKeyEvent, registerTvKeyHandler, tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { useMusicPreviewBar } from "@/hooks/useMusicPreviewBar";
import { colors } from "@/constants/theme";
import { photoMediumSrc } from "@/lib/mediaUrl";

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mediaId = Number(id);
  const router = useRouter();
  const goBack = useCallback(() => router.back(), [router]);
  useTvBackHandler(goBack);
  useMusicPreviewBar();
  const isFocused = useIsFocused();

  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  // Immediate index — only updated by key handlers / load, never clobbered from state.
  const indexRef = useRef(index);
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const detail = await fetchMediaDetail(mediaId);
        let items: MediaItem[] = [];
        if (detail.library_id) {
          items = await fetchMedia(detail.library_id, {
            file_type: "image",
            sort: "taken_desc",
            limit: 500,
          });
        }
        if (cancelled) return;

        const list = items.length > 0 ? items : [detail as MediaDetail];
        const idx = list.findIndex((p) => p.id === mediaId);
        setPhotos(list);
        setIndex(idx >= 0 ? idx : 0);
        indexRef.current = idx >= 0 ? idx : 0;
      } catch {
        if (!cancelled) {
          setPhotos([]);
          setIndex(0);
          indexRef.current = 0;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  useEffect(() => {
    if (!TV_NAV_ENABLED) return;
    const handler = (evt: TvKeyEvent) => {
      if (!isFocusedRef.current) return;

      const type = tvNavigationEventType(evt.eventType);
      if (type !== "left" && type !== "right") return;

      const list = photosRef.current;
      if (list.length <= 1) return;

      const cur = indexRef.current;
      consumeTvKeyEvent(evt);

      if (type === "left" && cur > 0) {
        const next = cur - 1;
        indexRef.current = next;
        setIndex(next);
        return;
      }
      if (type === "right" && cur < list.length - 1) {
        const next = cur + 1;
        indexRef.current = next;
        setIndex(next);
      }
    };
    return registerTvKeyHandler(handler);
  }, []);

  if (loading) return <LoadingState />;

  const current = photos[index];
  const uri = current ? photoMediumSrc(current.id) : null;

  return (
    <View style={styles.container}>
      {TV_NAV_ENABLED ? (
        <Pressable focusable hasTVPreferredFocus accessible style={styles.tvEventSink} />
      ) : null}
      {uri ? <Image source={{ uri }} style={styles.image} contentFit="contain" transition={200} /> : null}
      {photos.length > 1 ? (
        <Text style={styles.counter}>
          {index + 1} / {photos.length}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep, justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  counter: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    color: "rgba(255,255,255,0.75)",
    fontSize: 18,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tvEventSink: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    left: 0,
    top: 0,
    zIndex: 1,
  },
});

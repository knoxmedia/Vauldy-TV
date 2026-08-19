import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useIsFocused } from "@react-navigation/native";
import {
  fetchAuthenticatedText,
  fetchDocumentDetail,
  fetchDocumentPreviewInfo,
  fetchMediaDetail,
  fetchReadProgress,
  saveReadProgress,
} from "@/api/client";
import { useTvBackHandler } from "@/components/focus/TvBackButton";
import LoadingState, { Screen } from "@/components/LoadingState";
import { consumeTvKeyEvent, registerTvKeyHandler, tvNavigationEventType, type TvKeyEvent } from "@/hooks/tvKeyDispatcher";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";
import { useMusicPreviewBar } from "@/hooks/useMusicPreviewBar";
import { colors, spacing } from "@/constants/theme";
import { t } from "@/i18n";
import {
  buildPdfViewerHtmlFromUrl,
  buildTextViewerHtml,
  isOfficeDocumentFormat,
  normalizeDocumentFormat,
  parseResumePage,
  TEXT_DOCUMENT_FORMATS,
} from "@/lib/documentPdfViewer";
import { resolveBundledPdfJsAsset } from "@/lib/bundledPdfJs";
import { documentPreviewSrc, mediaPlaySrc } from "@/lib/mediaUrl";

type ViewerMode = "pdf" | "text";

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mediaId = Number(id);
  const router = useRouter();
  const goBack = useCallback(() => router.back(), [router]);
  useTvBackHandler(goBack);
  useMusicPreviewBar();
  const isFocused = useIsFocused();

  const [title, setTitle] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [webBaseUrl, setWebBaseUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewerMode>("pdf");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);

  const webRef = useRef<WebView>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotReady(false);
      setError(null);
      setHtml(null);
      setWebBaseUrl(undefined);
      setPage(1);
      setPages(0);

      try {
        const [detail, media, progress] = await Promise.all([
          fetchDocumentDetail(mediaId),
          fetchMediaDetail(mediaId),
          fetchReadProgress(mediaId).catch(() => null),
        ]);
        if (cancelled) return;

        setTitle(detail.title || media.title);
        const format = normalizeDocumentFormat(detail.format || media.format, media.file_path);
        const resumePage = parseResumePage(progress?.position);

        if (format === "pdf" || isOfficeDocumentFormat(format)) {
          if (isOfficeDocumentFormat(format)) {
            const info = await fetchDocumentPreviewInfo(mediaId);
            if (!info.preview_ready) {
              setNotReady(true);
              return;
            }
          }

          const pdfUrl = isOfficeDocumentFormat(format)
            ? documentPreviewSrc(mediaId)
            : mediaPlaySrc(mediaId);
          const pdfAsset = await resolveBundledPdfJsAsset();
          if (cancelled) return;
          setMode("pdf");
          setPage(resumePage);
          pageRef.current = resumePage;
          setWebBaseUrl(pdfAsset.baseUrl);
          setHtml(buildPdfViewerHtmlFromUrl(pdfUrl, pdfAsset.scriptSrc, resumePage));
          return;
        }

        if (TEXT_DOCUMENT_FORMATS.has(format)) {
          const text = await fetchAuthenticatedText(`/api/v1/media/${mediaId}/play`);
          if (cancelled) return;
          setMode("text");
          setHtml(buildTextViewerHtml(text, format));
          return;
        }

        setNotReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("reader.not_ready"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (modeRef.current === "pdf" && pagesRef.current > 0) {
        const percent = Math.round((pageRef.current / pagesRef.current) * 100);
        saveReadProgress(mediaId, pageRef.current, percent).catch(() => {});
      }
    };
  }, [mediaId]);

  useEffect(() => {
    if (!TV_NAV_ENABLED) return;
    const handler = (evt: TvKeyEvent) => {
      if (!isFocusedRef.current) return;
      if (modeRef.current !== "pdf") return;

      const type = tvNavigationEventType(evt.eventType);
      if (type !== "left" && type !== "right") return;

      const cur = pageRef.current;
      const total = pagesRef.current;
      if (total <= 1) return;

      consumeTvKeyEvent(evt);

      if (type === "left" && cur > 1) {
        const next = cur - 1;
        pageRef.current = next;
        setPage(next);
        webRef.current?.injectJavaScript(`window.goToPage(${next}); true;`);
        return;
      }
      if (type === "right" && cur < total) {
        const next = cur + 1;
        pageRef.current = next;
        setPage(next);
        webRef.current?.injectJavaScript(`window.goToPage(${next}); true;`);
      }
    };
    return registerTvKeyHandler(handler);
  }, []);

  const onWebMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        page?: number;
        pages?: number;
        message?: string;
      };
      if (msg.type === "ready" || msg.type === "page") {
        if (msg.page) {
          pageRef.current = msg.page;
          setPage(msg.page);
        }
        if (msg.pages) {
          pagesRef.current = msg.pages;
          setPages(msg.pages);
        }
      }
      if (msg.type === "error" && msg.message) {
        setError(msg.message);
      }
    } catch {
      /* ignore malformed messages */
    }
  }, []);

  if (loading) return <LoadingState label={t("reader.loading")} />;

  if (notReady || error || !html) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.text}>{error || t("reader.not_ready")}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {mode === "pdf" && pages > 0 ? (
          <Text style={styles.pageIndicator}>
            {page} / {pages}
          </Text>
        ) : null}
      </View>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={webBaseUrl ? { html, baseUrl: webBaseUrl } : { html }}
        style={styles.webview}
        onMessage={onWebMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowFileAccessFromFileURLs={!!webBaseUrl}
        allowUniversalAccessFromFileURLs={!!webBaseUrl}
        mixedContentMode="always"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, color: colors.text, fontSize: 28, fontWeight: "700" },
  pageIndicator: { color: colors.textSecondary, fontSize: 18, fontWeight: "600" },
  webview: { flex: 1, backgroundColor: colors.background },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  text: { color: colors.textSecondary, fontSize: 20, textAlign: "center" },
});

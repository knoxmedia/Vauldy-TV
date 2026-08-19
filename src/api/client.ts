import axios, { type AxiosInstance } from "axios";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";
import type {
  BrandingInfo,
  DocumentDetail,
  DocumentPreviewInfo,
  EpisodeRow,
  HistoryItem,
  Library,
  MediaDetail,
  MediaItem,
  MediaSubtitleRow,
  MusicTrackRow,
  PlaybackPlan,
  ReadProgress,
  SeriesDetail,
  SeriesPlayTarget,
  SeriesSummary,
  SessionUserInfo,
} from "./types";
import { CONTINUE_WATCHING_LIBRARY_TYPES } from "@/lib/homeHistory";

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

const DEFAULT_TIMEOUT_MS = 120000;
const HEALTH_TIMEOUT_MS = 10000;

function createApi(): AxiosInstance {
  const instance = axios.create({ timeout: DEFAULT_TIMEOUT_MS });
  instance.interceptors.request.use((config) => {
    const base = useConfigStore.getState().serverUrl;
    // Do not overwrite an explicit baseURL (e.g. health check before saving config)
    if (base && !config.baseURL) config.baseURL = base;
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      const url: string = err?.config?.url || "";
      if (status === 401 && !url.includes("/user/login")) {
        useAuthStore.getState().clearSession();
        onUnauthorized?.();
      }
      return Promise.reject(err);
    },
  );
  return instance;
}

const api = createApi();

export async function checkHealth(serverUrl?: string): Promise<boolean> {
  const base = (serverUrl ?? useConfigStore.getState().serverUrl ?? "").replace(/\/+$/, "");
  if (!base) return false;
  // Use absolute URL + fetch so setup does not depend on axios baseURL / store timing.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { response?: { status: number } };
      err.response = { status: res.status };
      throw err;
    }
    const data = (await res.json()) as { status?: string };
    return data?.status === "ok";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutErr = new Error("timeout") as Error & { code?: string };
      timeoutErr.code = "ECONNABORTED";
      throw timeoutErr;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Map axios / network failures to i18n keys for the setup / settings connect UI. */
export function connectionFailureKey(error: unknown): string {
  if (error instanceof Error && error.message === "health") return "setup.failure_http";
  const err = error as {
    code?: string;
    message?: string;
    name?: string;
    response?: { status?: number };
  };
  if (err?.response?.status) return "setup.failure_http";
  const code = String(err?.code || "").toUpperCase();
  const msg = String(err?.message || "").toLowerCase();
  if (
    code === "ECONNABORTED" ||
    err?.name === "AbortError" ||
    msg.includes("timeout") ||
    msg === "aborted"
  ) {
    return "setup.failure_timeout";
  }
  if (msg.includes("certificate") || msg.includes("ssl") || msg.includes("cert") || msg.includes("cleartext")) {
    return "setup.failure_cert";
  }
  if (code === "ENOTFOUND" || msg.includes("getaddrinfo") || msg.includes("nodename")) {
    return "setup.failure_dns";
  }
  return "setup.failure_unreachable";
}

export function connectionFailureDetail(error: unknown): string {
  const err = error as { message?: string; code?: string; response?: { status?: number } };
  const parts = [
    err?.code ? String(err.code) : "",
    err?.response?.status ? `HTTP ${err.response.status}` : "",
    err?.message ? String(err.message) : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function fetchBranding(): Promise<BrandingInfo> {
  const { data } = await api.get<BrandingInfo>("/api/v1/branding");
  return data;
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post<{ token: string }>("/api/v1/user/login", { username, password });
  return data.token;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/v1/user/logout");
  } catch {
    /* ignore */
  }
}

export async function fetchUserInfo(): Promise<SessionUserInfo> {
  const { data } = await api.get<SessionUserInfo>("/api/v1/user/info");
  return data;
}

export async function updateUserProfile(payload: { ui_locale?: string }) {
  const { data } = await api.put("/api/v1/user/profile", payload);
  return data;
}

export async function fetchLibraries(): Promise<Library[]> {
  const { data } = await api.get<{ items?: Library[] }>("/api/v1/library");
  return data?.items ?? [];
}

export async function fetchLibraryTracks(libraryId: number): Promise<MusicTrackRow[]> {
  const { data } = await api.get<{ items?: MusicTrackRow[] }>(`/api/v1/library/${libraryId}/tracks`);
  return data?.items ?? [];
}

export async function fetchMedia(
  libraryId?: number,
  opts?: {
    sort?: "id_desc" | "created_desc" | "taken_desc";
    limit?: number;
    file_type?: string;
    q?: string;
  },
): Promise<MediaItem[]> {
  const params: Record<string, string | number> = {};
  if (libraryId !== undefined) params.library_id = libraryId;
  if (opts?.sort) params.sort = opts.sort;
  if (opts?.limit !== undefined) params.limit = opts.limit;
  if (opts?.file_type) params.file_type = opts.file_type;
  if (opts?.q) params.q = opts.q;
  const { data } = await api.get<{ items?: MediaItem[] }>("/api/v1/media", { params });
  return data?.items ?? [];
}

export async function fetchMediaDetail(mediaId: number): Promise<MediaDetail> {
  const { data } = await api.get<MediaDetail>(`/api/v1/media/${mediaId}`);
  return data;
}

export type MediaLyricsResponse = {
  lrc: string;
  source?: string;
};

export async function fetchMediaLyrics(mediaId: number): Promise<MediaLyricsResponse> {
  const { data } = await api.get<MediaLyricsResponse>(`/api/v1/media/${mediaId}/lyrics`);
  return data ?? { lrc: "", source: "" };
}

export async function fetchMediaSubtitles(mediaId: number): Promise<MediaSubtitleRow[]> {
  const { data } = await api.get<{ items?: MediaSubtitleRow[] }>(`/api/v1/media/${mediaId}/subtitles`);
  return (data?.items ?? []).filter((row) => row.id > 0);
}

export function mediaSubtitleVttPath(mediaId: number, subtitleId: number): string {
  return `/api/v1/media/${mediaId}/subtitles/${subtitleId}/vtt`;
}

export function dedupeUserHistory(items: HistoryItem[]): HistoryItem[] {
  const out: HistoryItem[] = [];
  const seenMedia = new Set<number>();
  const seenFile = new Set<string>();
  for (const h of items) {
    if (h.media_id > 0) {
      if (seenMedia.has(h.media_id)) continue;
      seenMedia.add(h.media_id);
    } else if (h.file_id) {
      if (seenFile.has(h.file_id)) continue;
      seenFile.add(h.file_id);
    }
    out.push(h);
  }
  return out;
}

export async function fetchUserHistory(
  limit = 24,
  opts?: { libraryTypes?: readonly string[] },
): Promise<HistoryItem[]> {
  const params: Record<string, string | number> = { limit };
  const types = opts?.libraryTypes?.map((t) => t.trim()).filter(Boolean);
  if (types?.length) {
    params.library_types = types.join(",");
  }
  const { data } = await api.get<{ items?: HistoryItem[] }>("/api/v1/user/history", { params });
  return dedupeUserHistory(data?.items ?? []).filter((h) => h.media_id > 0);
}

export async function fetchContinueWatchingHistory(limit = 24): Promise<HistoryItem[]> {
  return fetchUserHistory(limit, { libraryTypes: CONTINUE_WATCHING_LIBRARY_TYPES });
}

export async function fetchFavorites(): Promise<MediaItem[]> {
  const { data } = await api.get<{ items?: MediaItem[] }>("/api/v1/favorites");
  return data?.items ?? [];
}

export async function fetchFavoriteStatus(mediaId: number): Promise<boolean> {
  const { data } = await api.get<{ favorited: boolean }>(`/api/v1/media/${mediaId}/favorite`);
  return data.favorited;
}

export async function addFavorite(mediaId: number): Promise<void> {
  await api.post(`/api/v1/media/${mediaId}/favorite`);
}

export async function removeFavorite(mediaId: number): Promise<void> {
  await api.delete(`/api/v1/media/${mediaId}/favorite`);
}

const FORCE_TRANSCODE_VIDEO_CODEC_SENTINEL = "__vauldy_force_transcode__";

export async function fetchPlaybackPlan(
  mediaId: number,
  opts?: { forceTranscode?: boolean },
): Promise<PlaybackPlan> {
  const params = opts?.forceTranscode
    ? { video_codecs: FORCE_TRANSCODE_VIDEO_CODEC_SENTINEL }
    : undefined;
  const { data } = await api.get<PlaybackPlan>(`/api/v1/media/${mediaId}/hls`, { params });
  return data;
}

export async function saveProgress(mediaId: number, position: number, completed = false): Promise<void> {
  await api.post(`/api/v1/media/${mediaId}/progress`, {
    position,
    completed: completed ? 1 : 0,
  });
}

export async function fetchMediaProgress(mediaId: number): Promise<{ position: number; completed?: number } | null> {
  try {
    const { data } = await api.get<{ position?: number; completed?: number }>(`/api/v1/media/${mediaId}/progress`);
    if (data?.position == null || data.position <= 0) return null;
    return { position: data.position, completed: data.completed };
  } catch {
    return null;
  }
}

export async function fetchDocumentDetail(mediaId: number): Promise<DocumentDetail> {
  const { data } = await api.get<DocumentDetail>(`/api/v1/media/${mediaId}/document`);
  return data;
}

export async function fetchDocumentPreviewInfo(mediaId: number): Promise<DocumentPreviewInfo> {
  const { data } = await api.get<DocumentPreviewInfo>(`/api/v1/media/${mediaId}/document/preview/info`);
  return data;
}

export async function fetchAuthenticatedText(path: string): Promise<string> {
  const { data } = await api.get<string>(path, { responseType: "text" });
  return data;
}

export async function fetchReadProgress(mediaId: number): Promise<ReadProgress | null> {
  const { data } = await api.get<ReadProgress | null>(`/api/v1/media/${mediaId}/read-progress`);
  return data;
}

export async function saveReadProgress(mediaId: number, position: number, percent: number): Promise<void> {
  await api.post(`/api/v1/media/${mediaId}/read-progress`, { position, percent });
}

export async function playbackStart(mediaId: number): Promise<void> {
  try {
    await api.post(`/api/v1/media/${mediaId}/playback/start`);
  } catch {
    /* ignore */
  }
}

export async function playbackEnd(mediaId: number): Promise<void> {
  try {
    await api.post(`/api/v1/media/${mediaId}/playback/end`);
  } catch {
    /* ignore */
  }
}

export async function fetchLibrarySeries(libraryId: number): Promise<SeriesSummary[]> {
  const { data } = await api.get<{ items?: SeriesSummary[] }>(`/api/v1/library/${libraryId}/series`);
  return data?.items ?? [];
}

export async function fetchSeries(seriesId: number): Promise<SeriesDetail> {
  const { data } = await api.get<SeriesDetail>(`/api/v1/series/${seriesId}`);
  return data;
}

export async function fetchSeasonEpisodes(seasonId: number): Promise<EpisodeRow[]> {
  const { data } = await api.get<{ items?: EpisodeRow[] }>(`/api/v1/season/${seasonId}/episodes`);
  return data?.items ?? [];
}

export async function fetchSeriesPlayTarget(seriesId: number): Promise<SeriesPlayTarget> {
  const { data } = await api.get<SeriesPlayTarget>(`/api/v1/series/${seriesId}/play-target`);
  return data;
}

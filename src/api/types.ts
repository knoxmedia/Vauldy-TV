export type UserRole = "admin" | "user" | "api_client";

export type Library = {
  id: number;
  name: string;
  type: string;
  path: string;
  folders?: string[];
  auto_scan: number;
  enabled?: number;
  media_count?: number;
  preview_url?: string;
  drm_enabled?: number;
};

export type MediaItem = {
  id: number;
  library_id: number;
  file_id: string;
  title: string;
  original_title?: string;
  file_path: string;
  file_type: string;
  duration: number;
  width: number;
  height: number;
  format: string;
  status: string;
  created_at?: string;
  last_play_at?: string;
  completed?: number;
  release_date?: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  photo_taken_at?: string;
  photo_tags?: string[];
  scraped?: boolean;
  encrypted_asset?: boolean;
  music_album_id?: number;
  music_album_title?: string;
  music_artist?: string;
  library_type?: string;
  overview?: string;
};

export type MediaDetail = MediaItem & {
  md5?: string;
  meta_json?: string;
  bitrate?: number;
  music_album_id?: number;
  music_album_title?: string;
  music_artist?: string;
};

export type MusicTrackRow = {
  id: number;
  media_id: number;
  track_number?: number;
  title: string;
  artist?: string;
  duration?: number;
  bitrate?: number;
  format?: string;
  album_id?: number;
  album_title?: string;
  album_artist?: string;
  artist_id?: number;
  year?: number;
  artwork_path?: string;
  file_path?: string;
  created_at?: string;
};

export type HistoryItem = {
  file_id?: string;
  media_id: number;
  title: string;
  file_path?: string;
  file_type?: string;
  library_id?: number;
  library_type?: string;
  position: number;
  duration: number;
  update_at?: string;
  play_start_at?: string;
  play_end_at?: string;
  completed?: number;
  play_count?: number;
  poster_url?: string;
  backdrop_url?: string;
  last_play_at?: string;
  encrypted_asset?: boolean;
};

export type SessionUserInfo = {
  id: number;
  username: string;
  role: UserRole;
  can_play?: boolean;
  can_download?: boolean;
  avatar_url?: string;
  ui_locale?: string;
};

export type BrandingInfo = {
  app_name: string;
  favicon_url?: string;
};

export type PlaybackPlan = {
  status?: string;
  mode?: string;
  hls_master?: string;
  fallback?: string;
  session_id?: string;
  drm?: Record<string, string>;
  ready?: boolean;
};

export type DocumentDetail = {
  id: number;
  title: string;
  author?: string;
  format?: string;
  pages?: number;
  file_path?: string;
};

export type DocumentPreviewInfo = {
  needs_preview: boolean;
  preview_ready: boolean;
  preview_url?: string;
  conversion_enabled?: boolean;
};

export type ReadProgress = {
  position: number;
  percent: number;
  updated_at?: string;
};

export type SeriesSummary = {
  id: number;
  library_id: number;
  title: string;
  year?: number;
  poster?: string;
  poster_url?: string;
  season_count?: number;
  episode_count?: number;
};

export type SeasonSummary = {
  id: number;
  season_num: number;
  name: string;
  poster?: string;
  episode_count?: number;
};

export type EpisodeMediaVersion = {
  media_id: number;
  file_id?: string;
  title?: string;
  duration?: number;
  sort_order?: number;
  poster_url?: string;
  completed?: number;
};

export type EpisodeRow = {
  id: number;
  episode_num: number;
  title?: string;
  duration?: number;
  versions?: EpisodeMediaVersion[];
};

export type SeriesDetail = {
  id: number;
  library_id: number;
  title: string;
  year?: number;
  poster?: string;
  poster_url?: string;
  meta_json?: string;
  seasons?: SeasonSummary[];
};

export type SeriesPlayTarget = {
  media_id: number;
  position: number;
};

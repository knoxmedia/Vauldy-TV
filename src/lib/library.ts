const TV_TYPES = new Set(["tv", "anime", "television", "series"]);
const MUSIC_TYPES = new Set(["music"]);
const PHOTO_TYPES = new Set(["photo"]);
const DOCUMENT_TYPES = new Set(["document"]);

export function isTVLibraryType(type: string): boolean {
  return TV_TYPES.has(type);
}

export function isMusicLibraryType(type: string): boolean {
  return MUSIC_TYPES.has(type);
}

export function isPhotoLibraryType(type: string): boolean {
  return PHOTO_TYPES.has(type);
}

export function isDocumentLibraryType(type: string): boolean {
  return DOCUMENT_TYPES.has(type);
}

export function libraryFileType(type: string): string | undefined {
  if (isMusicLibraryType(type)) return "audio";
  if (isPhotoLibraryType(type)) return "image";
  if (isDocumentLibraryType(type)) return "document";
  if (type === "movie" || type === "video" || isTVLibraryType(type)) return "video";
  return undefined;
}

export function libraryTypeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    movie: t("library.type.movie"),
    tv: t("library.type.tv"),
    anime: t("library.type.anime"),
    music: t("library.type.music"),
    photo: t("library.type.photo"),
    document: t("library.type.document"),
    video: t("library.type.video"),
  };
  return map[type] || type;
}

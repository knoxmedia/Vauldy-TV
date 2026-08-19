# Vauldy TV Release Notes

## v0.1.1 - TV Navigation and Search Update

Released: 2026-08-19

This release improves day-to-day Android TV navigation, expands search and playback capabilities, and adds account and interface controls requested by Vauldy users.

### Highlights

- Added full-media search with a multi-row result grid.
- Added Chinese title matching by full pinyin and pinyin initials.
- Added recent-search history, capped at the 10 latest unique terms, with a Clear history action.
- Added a History page grouped by time and restored card focus after returning from detail screens.
- Added runtime switching between Simplified Chinese and English, plus a new About page.
- Added external WebVTT subtitle discovery, display, and track switching in the video player.
- Enforced the server `can_play` permission before starting audio or video playback.
- Migrated authentication tokens from AsyncStorage to Expo SecureStore with automatic legacy migration.

### Remote-control navigation

- Reworked TV focus handling so the highlighted item and the item activated by OK stay synchronized.
- Added key-down/key-up de-duplication while retaining compatibility with remotes that emit release-only events.
- Normalized long-press directional events for continuous D-pad navigation.
- Improved focus transitions between the sidebar, content area, settings fields, search keyboard, media grids, and player controls.
- Prevented duplicate sidebar/content highlights and disabled conflicting touch handlers on TV builds.
- Improved exit behavior while preserving touch navigation on non-TV platforms.

### Search and input

- Added a programmatically focused on-screen TV keyboard with faster directional movement and text entry.
- Deferred expensive pinyin indexing until keyboard input is complete and processes the catalog in chunks to keep the interface responsive.
- Limited rendered category and pinyin results to avoid stalls on large libraries.
- Added automatic scrolling to keep the selected grid item visible.

### Playback and compatibility

- Added playback URL fallback and improved resume URL handling.
- Allowed LAN HTTP servers in Android TV builds and hardened server connection handling.
- Continued to support HLS/direct playback, resume progress, series auto-play, music, photos, and PDF documents.

### Upgrade notes

- Existing login tokens are migrated to SecureStore automatically on first launch.
- Pinyin search adds the `pinyin-pro` runtime dependency.
- Rebuild and reinstall the Android TV package when upgrading from v0.1.0.

### Validation

- TypeScript type checking passes.
- Search history, pinyin search, history grouping, subtitle parsing, and related utility tests pass.

---

## v0.1.0 - Initial Release

## Overview

Vauldy TV is an Android TV client for Vauldy media server, built with Expo + react-native-tvos.
This initial release provides full media browsing, video playback, music streaming, TV series support,
and remote-control optimized navigation.

---

## Core Features

### Media Browsing
- **Home screen** — Continue Watching shelf with playback progress, Libraries grid, and Recent media rows
- **Browse** — Browse by library type (movies, TV series, photos, music, documents)
- **Favorites** — Grid view of favorited media items
- **Library detail** — Grid of media items within a library with sorting

### Video Playback
- Full video player with expo-av hardware decoding
- **D-pad seek** — Short press ±30s, long press ±60s on direction keys
- **On-screen controls** — Play/pause, fast-forward, rewind, stop with focusable buttons
- **Resume playback** — Automatically resumes from last playback position when re-entering a video
- **Progress saving** — Periodic progress sync to server during playback
- **Keep screen awake** — Disables Android TV screensaver during active video playback

### TV Series
- **Series detail page** — Hero banner with poster artwork, season/episode counts
- **Season navigation** — Horizontal season tab bar for switching between seasons
- **Episode list** — Sorted episode list with poster thumbnails and **watched status badges**
- **Playback actions** — "Continue" (resume from last episode) and "Play from start" buttons
- **Auto-play next** — At episode end, shows a **corner overlay** with next episode poster, title, and countdown
  - Press **OK** → skip countdown, play next episode immediately
  - Press **Back** → cancel, stay on current screen
- **Series playback session** — Remembers series play order across episodes for seamless continuation

### Music Player
- Full-screen music player with album art, artist/album metadata, and seek controls
- **Lyrics panel** — Synchronized lyrics display with auto-scroll (LRC format)
- **Floating mini-bar** — Persistent music controls at screen bottom while browsing
- **Queue navigation** — Previous/next track with queue index tracking
- D-pad optimized control buttons (play/pause, prev/next, seek, stop)

### Documents & Photos
- **PDF/Document viewer** — Embedded PDF.js renderer with reading progress sync
- **Photo viewer** — Full-screen image viewer with swipe gestures

### Remote Control Navigation
- **Three-zone focus system** — Sidebar navigation, content area, and back button focus zones
- **Programmatic focus** — Custom TV focus management via global key event dispatcher
- **Sidebar navigation** — Home / Browse / Favorites / Settings with D-pad selection
- **Grid & list navigation** — Smart grid cell navigation (up/down/left/right), horizontal shelf scrolling
- **Exit confirmation** — Back button shows exit dialog when in sidebar zone

### Branding & Visual
- **Dark theme** — Custom dark color palette optimized for TV viewing
- **TV launcher icon** — Properly sized Android TV launcher icon via `@react-native-tvos/config-tv`
- **TV banner** — 320×180 Android TV home screen banner
- **Splash screen** — Full-screen 1920×1080 splash background

### Multi-language
- **English (en)** and **Simplified Chinese (zh-CN)** UI translations
- Covers all screens: home, browse, favorites, settings, player, series, music, login

---

## Technical Details

- **Platform**: Android TV (API 21+), leanback required
- **Framework**: Expo SDK 52 + react-native-tvos 0.76.9-0
- **Navigation**: expo-router (file-based routing with Stack navigator)
- **State**: Zustand stores for auth, config, music player, series playback, TV focus
- **Video**: expo-av Video component with HLS support
- **Audio**: expo-av shared global audio engine for background music
- **Network**: Axios HTTP client with session token auth
- **PDF**: pdfjs-dist 3.11 for document rendering

---

## Package

```json
{
  "name": "vauldy-tv",
  "version": "0.1.0",
  "package": "com.knoxmedia.vauldy.tv"
}
```

---

## Known Limitations

- Audio-only playback uses a hidden Video component (expo-av limitation for audio-only)
- Large photo libraries may impact grid rendering performance
- HLS streaming requires server-side HLS transcoding support
- Document viewer supports PDF only; other document formats are not rendered

---

*Generated 2026-07-14*

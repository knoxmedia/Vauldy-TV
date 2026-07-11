# TV Series Episodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TV/anime libraries browse as series, open a season-tab episode list with watched state, play episodes, and show a 10s cancellable next-episode prompt when an episode finishes.

**Architecture:** Mirror Web: call series/season APIs from Vauldy-TV, store an in-memory play session (`seriesId` + ordered `media_id[]`), navigate to `/player/:id?series_id=&index=&t=`, and on `didJustFinish` resolve the next media id for the countdown overlay.

**Tech Stack:** Expo 52 / react-native-tvos, expo-router, zustand, axios, vitest (pure lib unit tests), TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-11-series-episodes-design.md`

---

## File map

| File | Role |
|------|------|
| `src/api/types.ts` | Series/season/episode types |
| `src/api/client.ts` | `fetchLibrarySeries`, `fetchSeries`, `fetchSeasonEpisodes`, `fetchSeriesPlayTarget` |
| `src/lib/library.ts` | Widen `isTVLibraryType` aliases |
| `src/lib/seriesPlayback.ts` | Pure helpers: primary media, next resolve, order build helpers |
| `src/lib/seriesPlayback.test.ts` | Unit tests for helpers |
| `src/store/seriesPlay.ts` | Zustand session `{ seriesId, order }` |
| `src/components/series/SeriesCard.tsx` | Poster card for series grid |
| `src/components/series/EpisodeList.tsx` | Focusable episode rows + completed badge |
| `src/components/player/NextEpisodeOverlay.tsx` | 10s countdown UI |
| `app/library/[id].tsx` | Branch TV libs to series grid |
| `app/series/[id].tsx` | Series detail (tabs + list + play actions) |
| `app/player/[id].tsx` | Resume `t`, next-episode on finish |
| `src/i18n/zh-CN.ts`, `en.ts` | Strings |
| `package.json` | Add `vitest` + `test` script |

---

### Task 1: Series API types + client

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/api/client.ts`
- Modify: `src/lib/library.ts`

- [ ] **Step 1: Append types to `src/api/types.ts`**

```ts
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
```

- [ ] **Step 2: Add client functions in `src/api/client.ts`**

Import the new types. Add:

```ts
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
```

- [ ] **Step 3: Widen TV library detection in `src/lib/library.ts`**

```ts
const TV_TYPES = new Set(["tv", "anime", "television", "series"]);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`  
Expected: PASS (no errors from new exports)

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts src/api/client.ts src/lib/library.ts
git commit -m "feat(tv): add series API types and client helpers"
```

---

### Task 2: Pure playback helpers + vitest

**Files:**
- Create: `src/lib/seriesPlayback.ts`
- Create: `src/lib/seriesPlayback.test.ts`
- Modify: `package.json`
- Create: `vitest.config.ts` (minimal)

- [ ] **Step 1: Install vitest**

Run from `Vauldy-TV`:

```bash
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Note: tests import relative paths from `./seriesPlayback` to avoid alias issues if needed.

- [ ] **Step 2: Write failing tests in `src/lib/seriesPlayback.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  pickPrimaryEpisodeMediaId,
  resolveNextSeriesMedia,
  primaryMediaIdsFromEpisodes,
} from "./seriesPlayback";
import type { EpisodeRow } from "@/api/types";

describe("pickPrimaryEpisodeMediaId", () => {
  it("picks lowest sort_order version", () => {
    const ep: EpisodeRow = {
      id: 1,
      episode_num: 1,
      versions: [
        { media_id: 20, sort_order: 2 },
        { media_id: 10, sort_order: 1 },
      ],
    };
    expect(pickPrimaryEpisodeMediaId(ep)).toBe(10);
  });

  it("returns null when no versions", () => {
    expect(pickPrimaryEpisodeMediaId({ id: 1, episode_num: 1, versions: [] })).toBeNull();
  });
});

describe("primaryMediaIdsFromEpisodes", () => {
  it("sorts by episode_num and skips empty versions", () => {
    const items: EpisodeRow[] = [
      { id: 2, episode_num: 2, versions: [{ media_id: 200 }] },
      { id: 1, episode_num: 1, versions: [{ media_id: 100 }] },
      { id: 3, episode_num: 3, versions: [] },
    ];
    expect(primaryMediaIdsFromEpisodes(items)).toEqual([100, 200]);
  });
});

describe("resolveNextSeriesMedia", () => {
  const session = { seriesId: 5, order: [10, 20, 30] };

  it("returns next by index", () => {
    expect(resolveNextSeriesMedia(session, 10, 0)).toEqual({ mediaId: 20, index: 1 });
  });

  it("returns null on last", () => {
    expect(resolveNextSeriesMedia(session, 30, 2)).toBeNull();
  });

  it("finds by media id when index wrong", () => {
    expect(resolveNextSeriesMedia(session, 20, null)).toEqual({ mediaId: 30, index: 2 });
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm test`  
Expected: FAIL (module / exports missing)

- [ ] **Step 4: Implement `src/lib/seriesPlayback.ts`**

```ts
import type { EpisodeRow, SeasonSummary } from "@/api/types";
import { fetchSeasonEpisodes } from "@/api/client";

export type SeriesPlaySession = {
  seriesId: number;
  order: number[];
};

export function pickPrimaryEpisodeMediaId(ep: EpisodeRow): number | null {
  const versions = ep.versions ?? [];
  if (versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const mid = sorted[0]?.media_id;
  return mid != null && mid > 0 ? mid : null;
}

export function primaryMediaIdsFromEpisodes(items: EpisodeRow[]): number[] {
  const sorted = [...items].sort((a, b) => a.episode_num - b.episode_num);
  const out: number[] = [];
  for (const ep of sorted) {
    const mid = pickPrimaryEpisodeMediaId(ep);
    if (mid != null) out.push(mid);
  }
  return out;
}

export function resolveNextSeriesMedia(
  session: SeriesPlaySession,
  currentMediaId: number,
  currentIndex: number | null,
): { mediaId: number; index: number } | null {
  const { order } = session;
  let pos = currentIndex;
  if (pos == null || pos < 0 || pos >= order.length || order[pos] !== currentMediaId) {
    pos = order.indexOf(currentMediaId);
  }
  if (pos < 0 || pos + 1 >= order.length) return null;
  const nextIndex = pos + 1;
  return { mediaId: order[nextIndex]!, index: nextIndex };
}

/** Fetch all seasons’ episodes and build primary media order. */
export async function fetchSeriesEpisodeMediaOrder(seasons: SeasonSummary[]): Promise<number[]> {
  const order: number[] = [];
  const sortedSeasons = [...seasons].sort((a, b) => a.season_num - b.season_num);
  for (const season of sortedSeasons) {
    let items: EpisodeRow[] = [];
    try {
      items = await fetchSeasonEpisodes(season.id);
    } catch {
      continue;
    }
    order.push(...primaryMediaIdsFromEpisodes(items));
  }
  return order;
}

export function episodeIsCompleted(ep: EpisodeRow): boolean {
  const mid = pickPrimaryEpisodeMediaId(ep);
  if (mid == null) return false;
  const versions = ep.versions ?? [];
  const v = versions.find((x) => x.media_id === mid) ?? versions[0];
  return (v?.completed ?? 0) > 0;
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test`  
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/seriesPlayback.ts src/lib/seriesPlayback.test.ts
git commit -m "feat(tv): add series playback helpers and unit tests"
```

---

### Task 3: Series play session store

**Files:**
- Create: `src/store/seriesPlay.ts`

- [ ] **Step 1: Create Zustand store**

```ts
import { create } from "zustand";
import type { SeriesPlaySession } from "@/lib/seriesPlayback";

type SeriesPlayState = {
  session: SeriesPlaySession | null;
  setSession: (seriesId: number, order: number[]) => void;
  clearSession: () => void;
};

export const useSeriesPlayStore = create<SeriesPlayState>((set) => ({
  session: null,
  setSession: (seriesId, order) =>
    set({ session: { seriesId, order: order.filter((id) => id > 0) } }),
  clearSession: () => set({ session: null }),
}));
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/store/seriesPlay.ts
git commit -m "feat(tv): add in-memory series play session store"
```

---

### Task 4: i18n strings

**Files:**
- Modify: `src/i18n/zh-CN.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Add keys (both locales)**

zh-CN:

```ts
"series.continue": "继续播放",
"series.play_from_start": "从头播放",
"series.season": "第 {n} 季",
"series.episode_n": "第 {n} 集",
"series.completed": "已看完",
"series.empty": "暂无剧集",
"series.no_episodes": "本季暂无分集",
"series.next_episode": "下一集",
"series.next_episode_in": "{n} 秒后播放下一集",
"series.cancel": "取消",
"series.play_now": "立即播放",
```

en:

```ts
"series.continue": "Continue",
"series.play_from_start": "Play from start",
"series.season": "Season {n}",
"series.episode_n": "Episode {n}",
"series.completed": "Watched",
"series.empty": "No series",
"series.no_episodes": "No episodes in this season",
"series.next_episode": "Next episode",
"series.next_episode_in": "Next episode in {n}s",
"series.cancel": "Cancel",
"series.play_now": "Play now",
```

Ensure `t()` interpolation supports `{n}` the same way existing keys like `library.media_count` do. If `t` only does simple replace, match that pattern.

- [ ] **Step 2: Commit**

```bash
git add src/i18n/zh-CN.ts src/i18n/en.ts
git commit -m "feat(tv): add series and next-episode i18n strings"
```

---

### Task 5: SeriesCard + library browse branch

**Files:**
- Create: `src/components/series/SeriesCard.tsx`
- Modify: `app/library/[id].tsx`

- [ ] **Step 1: Create `SeriesCard`**

Mirror `MediaCard` layout (poster aspect, title, year). Poster via `withAccessToken(normalizeListPosterUrl(series.poster_url || series.poster || ""))`. Props: `series: SeriesSummary`, `onPress`, `tvSelected`, `layout?: "grid"`.

```tsx
// Key bits — full file should match MediaCard styling (border when tvSelected)
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SeriesSummary } from "@/api/types";
import { colors, radius } from "@/constants/theme";
import { normalizeListPosterUrl, withAccessToken } from "@/lib/mediaUrl";
import { TV_NAV_ENABLED } from "@/hooks/useTvRemoteNav";

type Props = {
  series: SeriesSummary;
  onPress: () => void;
  tvSelected?: boolean;
};

export default function SeriesCard({ series, onPress, tvSelected }: Props) {
  const raw = normalizeListPosterUrl(series.poster_url || series.poster || "");
  const poster = raw ? withAccessToken(raw) : "";
  // ... Image + title + year; Pressable disabled={TV_NAV_ENABLED} when using remote nav highlight
}
```

- [ ] **Step 2: Branch `app/library/[id].tsx` for TV libraries**

Import `isTVLibraryType`, `fetchLibrarySeries`, `SeriesSummary`, `SeriesCard`.

In `load()`:

```ts
if (lib && isTVLibraryType(lib.type)) {
  const series = await fetchLibrarySeries(libraryId);
  setSeriesItems(series);
  setItems([]);
  setTracks([]);
  return;
}
```

Add state: `const [seriesItems, setSeriesItems] = useState<SeriesSummary[]>([]);`

When `isTVLibraryType(library?.type)`:
- Grid data = `seriesItems`
- `onSelect` → `router.push(\`/series/${series.id}\`)`
- Render `SeriesCard` instead of `MediaCard`
- Empty copy: `t("series.empty")`

Keep music / flat media paths unchanged.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`  
Expected: PASS (series route may not exist yet — only push string path; Expo typed routes may warn — if typedRoutes errors, add placeholder `app/series/[id].tsx` in Task 6 first or use `href` as string cast)

If typed routes fail before Task 6, create a minimal stub screen in the same commit:

```tsx
// app/series/[id].tsx temporary stub
export default function SeriesStub() {
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/series/SeriesCard.tsx app/library/[id].tsx app/series/[id].tsx
git commit -m "feat(tv): browse TV libraries as series grid"
```

---

### Task 6: Series detail screen (season tabs + episode list)

**Files:**
- Create: `src/components/series/EpisodeList.tsx`
- Create/Replace: `app/series/[id].tsx`

- [ ] **Step 1: Create `EpisodeList.tsx`**

Vertical list of episodes. Each row: `E{n}` / title / duration / completed badge. Props:

```ts
type Props = {
  episodes: EpisodeRow[];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  onPressEpisode: (ep: EpisodeRow, index: number) => void;
};
```

Use `episodeIsCompleted` + `formatDuration` from mediaUrl. Highlight row when `selectedIndex === i` (same blue border pattern as music list). Disable rows with no primary media id.

- [ ] **Step 2: Implement `app/series/[id].tsx`**

Structure:

1. `TvBackButton` + title + year
2. Action row: Continue / Play from start (`FocusablePressable` or programmatic selection via `useTvRemoteNav` mode `controls` / zones)
3. Horizontal season tabs (`useTvRemoteNav` mode `horizontal` when focus in tabs zone)
4. `EpisodeList` with vertical nav

Data load:

```ts
const detail = await fetchSeries(seriesId);
const seasons = [...(detail.seasons ?? [])].sort((a, b) => a.season_num - b.season_num);
// default season index 0
const episodes = await fetchSeasonEpisodes(seasons[seasonIndex].id);
```

On season change, reload episodes.

**Start playback helper (local function):**

```ts
async function startSeriesPlayback(opts: {
  seriesId: number;
  seasons: SeasonSummary[];
  mediaId: number;
  indexInOrder?: number;
  positionSec?: number;
}) {
  const order = await fetchSeriesEpisodeMediaOrder(opts.seasons);
  useSeriesPlayStore.getState().setSession(opts.seriesId, order);
  const index =
    opts.indexInOrder ??
    Math.max(0, order.indexOf(opts.mediaId));
  const t = opts.positionSec && opts.positionSec > 0 ? `&t=${Math.floor(opts.positionSec)}` : "";
  router.push(`/player/${opts.mediaId}?series_id=${opts.seriesId}&index=${index}${t}`);
}
```

- **Continue:** `fetchSeriesPlayTarget(seriesId)` → `startSeriesPlayback({ mediaId, positionSec: position })`
- **Play from start:** first media in `order` (build order first), `positionSec: 0`
- **Episode OK:** `pickPrimaryEpisodeMediaId(ep)` → play; if play-target media matches this episode and position > 0, pass `t`

Remote focus zones suggestion:
- `back` / header actions / season tabs / episode list — follow existing `tvFocus` + `useTvRemoteNav` patterns from music list / media detail. Prefer one vertical list nav for episodes and left-exit to back; season tabs: left/right when focused on tabs row; up from episodes → tabs; up from tabs → actions/back.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/series/[id].tsx src/components/series/EpisodeList.tsx
git commit -m "feat(tv): add series detail with seasons and episode list"
```

---

### Task 7: Player resume + next-episode overlay

**Files:**
- Create: `src/components/player/NextEpisodeOverlay.tsx`
- Modify: `app/player/[id].tsx`

- [ ] **Step 1: Create `NextEpisodeOverlay.tsx`**

Props:

```ts
type Props = {
  visible: boolean;
  secondsLeft: number;
  onPlayNow: () => void;
  onCancel: () => void;
};
```

Full-screen dimmed center card: title `t("series.next_episode")`, subtitle `t("series.next_episode_in", { n: secondsLeft })`, two buttons Play now / Cancel. When visible, parent owns TV events (select = play now, back/menu = cancel). Visual selection on Play now by default.

- [ ] **Step 2: Wire player query params + finish handler**

In `app/player/[id].tsx`:

```ts
const { id, series_id, index, t: resumeT } = useLocalSearchParams<{
  id: string;
  series_id?: string;
  index?: string;
  t?: string;
}>();
```

After video loads / `onLoad`, if `resumeT` parses to > 0, `videoRef.current?.setPositionAsync(sec * 1000)` once.

Clear series session when starting non-series video:

```ts
useEffect(() => {
  if (!series_id) useSeriesPlayStore.getState().clearSession();
}, [series_id, mediaId]);
```

On `status.didJustFinish` (video only, not audio):

```ts
persistProgress(true);
const sid = series_id ? Number(series_id) : NaN;
const session = useSeriesPlayStore.getState().session;
if (session && sid === session.seriesId) {
  const idx = index != null && index !== "" ? Number(index) : null;
  const next = resolveNextSeriesMedia(session, mediaId, Number.isFinite(idx) ? idx : null);
  if (next) {
    setNextEpisode(next); // { mediaId, index }
    setNextCountdown(10);
    return;
  }
  useSeriesPlayStore.getState().clearSession();
}
```

Countdown `useEffect`: when `nextEpisode` set, interval 1s; at 0 call `goNextEpisode()`.

```ts
function goNextEpisode() {
  if (!nextEpisode || !series_id) return;
  const sid = Number(series_id);
  setNextEpisode(null);
  router.replace(`/player/${nextEpisode.mediaId}?series_id=${sid}&index=${nextEpisode.index}`);
}
```

Cancel: clear countdown state only (keep session).

TV handler when overlay visible: `select` → play now; `menu`/`back` → cancel (also ensure hardware back dismisses overlay before exiting player).

- [ ] **Step 3: Typecheck + unit tests**

Run: `npm run typecheck` && `npm test`  
Expected: both PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/player/NextEpisodeOverlay.tsx app/player/[id].tsx
git commit -m "feat(tv): resume series position and next-episode countdown"
```

---

### Task 8: Manual verification + release APK

**Files:** none (verification)

- [ ] **Step 1: Smoke checklist on device / emulator**

1. Open TV/anime library → series posters (not flat files).
2. Open series → season tabs + episode list; completed shows badge.
3. Play episode → player works.
4. Continue / Play from start work.
5. Finish mid-series episode → 10s overlay; wait advances; Cancel dismisses; Play now advances immediately.
6. Finish last episode → no overlay.
7. Movie library still flat media grid.

- [ ] **Step 2: Build armv7 APK**

Run: `npm run apk:release:armv7`  
Expected: `Release APK: .../dist/vauldy-tv-0.1.0-armeabi-v7a-release.apk`

- [ ] **Step 3: Final commit only if verification fixes were needed**

Otherwise stop after successful build.

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| TV library → series grid | 5 |
| Series detail season tabs + list | 6 |
| Completed indicator | 6 (`episodeIsCompleted`) |
| Play episode / continue / from start | 6 |
| Play session order | 2 + 3 + 6 |
| Resume `t` | 7 |
| 10s next episode cancellable | 7 |
| Last episode no prompt | 7 |
| Movie libs unchanged | 5 (branch only TV) |
| API client | 1 |
| Non-goals (versions UI, mark watched, edit) | omitted |

## Placeholder / consistency notes

- `EpisodeMediaVersion.completed` is `number` (0/1), matching Web.
- Store method names: `setSession` / `clearSession` / `session` — used consistently in Tasks 3, 6, 7.
- Helper names: `pickPrimaryEpisodeMediaId`, `resolveNextSeriesMedia`, `fetchSeriesEpisodeMediaOrder` — consistent with Web.

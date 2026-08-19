export type VttCue = {
  start: number;
  end: number;
  text: string;
};

function parseTimestamp(raw: string): number {
  const parts = raw.trim().replace(",", ".").split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return Number(m) * 60 + Number(s);
  }
  return Number(parts[0]) || 0;
}

/** Minimal WEBVTT parser for external subtitle overlays. */
export function parseVtt(content: string): VttCue[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/);
  const cues: VttCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd()).filter((l, i, arr) => !(i === 0 && !l) || arr.length > 1);
    if (lines.length === 0) continue;
    if (/^WEBVTT/i.test(lines[0]!) || /^NOTE\b/i.test(lines[0]!) || /^STYLE\b/i.test(lines[0]!)) {
      continue;
    }

    let timeLineIdx = 0;
    if (lines[0] && !lines[0].includes("-->")) timeLineIdx = 1;
    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes("-->")) continue;

    const [startRaw, endRaw] = timeLine.split("-->").map((s) => s.trim().split(/\s+/)[0] || "");
    const start = parseTimestamp(startRaw || "0");
    const end = parseTimestamp(endRaw || "0");
    if (!(end > start)) continue;

    const text = lines
      .slice(timeLineIdx + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) continue;
    cues.push({ start, end, text });
  }

  return cues;
}

export function activeCueText(cues: readonly VttCue[], positionSec: number): string {
  for (let i = cues.length - 1; i >= 0; i--) {
    const cue = cues[i]!;
    if (positionSec >= cue.start && positionSec < cue.end) return cue.text;
  }
  return "";
}

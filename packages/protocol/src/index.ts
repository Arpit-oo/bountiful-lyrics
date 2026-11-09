import { DEFAULT_SETTINGS, isHexColor, sanitizeSettings, type Line, type Palette, type Settings, type SyncedLyrics } from "@bountiful/core";

export const COMPANION_PORT = 39517;
export const SPOTIFY_ORIGIN = "https://xpui.app.spotify.com";
export const PROTOCOL_VERSION = 1;

const MAX_LINES = 2000;
const MAX_WORDS_PER_LINE = 200;
const MAX_BEATS = 4000;
const MAX_TEXT = 500;

export type CompanionMessage =
  | { type: "hello"; version: number }
  | { type: "track"; title: string; artist: string; durationMs: number; artUrl: string | null; beats: number[] }
  | { type: "lyrics"; lyrics: SyncedLyrics | null }
  | { type: "clock"; positionMs: number; playing: boolean; volume?: number }
  | { type: "theme"; palette: Palette }
  | { type: "settings"; settings: Settings }
  /** Ask the companion to show its lyrics window (the full-size, any-monitor pop-out). */
  | { type: "open" };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Art is only ever accepted from Spotify's image CDN. */
export function isAllowedArtUrl(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\/i\.scdn\.co\/image\/[0-9a-f]+$/.test(url);
}

function parseLine(v: unknown): Line | null {
  if (!isObj(v) || !isText(v.text) || !isNum(v.startMs) || !isNum(v.endMs)) return null;
  if (v.timing !== "word" && v.timing !== "estimated") return null;
  if (!Array.isArray(v.words) || v.words.length > MAX_WORDS_PER_LINE) return null;
  const words: Line["words"] = [];
  for (const w of v.words) {
    if (!isObj(w) || !isText(w.text) || !isNum(w.startMs) || !isNum(w.endMs)) return null;
    words.push({ text: w.text, startMs: w.startMs, endMs: w.endMs });
  }
  return { text: v.text, startMs: v.startMs, endMs: v.endMs, timing: v.timing, words };
}

function parseLyrics(v: unknown): SyncedLyrics | null | undefined {
  if (v === null) return null;
  if (!isObj(v) || v.kind !== "synced" || !isText(v.source) || !Array.isArray(v.lines) || v.lines.length > MAX_LINES) return undefined;
  const lines: Line[] = [];
  for (const raw of v.lines) {
    const line = parseLine(raw);
    if (!line) return undefined;
    lines.push(line);
  }
  return { kind: "synced", source: v.source, lines };
}

/** Validates an untrusted frame. Returns null for anything malformed. */
export function parseMessage(raw: string): CompanionMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v)) return null;
  switch (v.type) {
    case "hello":
      return isNum(v.version) ? { type: "hello", version: v.version } : null;
    case "track": {
      if (!isText(v.title) || !isText(v.artist) || !isNum(v.durationMs)) return null;
      if (v.artUrl !== null && !isAllowedArtUrl(v.artUrl)) return null;
      if (!Array.isArray(v.beats) || v.beats.length > MAX_BEATS || !v.beats.every(isNum)) return null;
      return { type: "track", title: v.title, artist: v.artist, durationMs: v.durationMs, artUrl: v.artUrl as string | null, beats: v.beats as number[] };
    }
    case "lyrics": {
      const lyrics = parseLyrics(v.lyrics);
      return lyrics === undefined ? null : { type: "lyrics", lyrics };
    }
    case "clock": {
      if (!isNum(v.positionMs) || typeof v.playing !== "boolean") return null;
      const clock: CompanionMessage = { type: "clock", positionMs: v.positionMs, playing: v.playing };
      if (isNum(v.volume) && v.volume >= 0 && v.volume <= 1) clock.volume = v.volume;
      return clock;
    }
    case "theme":
      return isObj(v.palette) && isHexColor(v.palette.primary) && isHexColor(v.palette.secondary)
        ? { type: "theme", palette: { primary: v.palette.primary, secondary: v.palette.secondary } }
        : null;
    case "settings":
      return { type: "settings", settings: sanitizeSettings(v.settings) };
    case "open":
      return { type: "open" };
    default:
      return null;
  }
}

/** Commands the companion window sends back to Spotify. */
export type ControlMessage =
  | { type: "control"; action: "toggle" | "next" | "previous" }
  | { type: "control"; action: "seek"; value: number }
  | { type: "control"; action: "volume"; value: number }
  | { type: "control"; action: "settings"; value: Partial<Settings> };

const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

/** Validates a control frame from the companion. Settings patches keep only known keys; the
 *  receiver still merges them through sanitizeSettings. */
export function parseControl(raw: string): ControlMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || v.type !== "control") return null;
  switch (v.action) {
    case "toggle":
    case "next":
    case "previous":
      return { type: "control", action: v.action };
    case "seek":
      return isNum(v.value) && v.value >= 0 ? { type: "control", action: "seek", value: v.value } : null;
    case "volume":
      return isNum(v.value) && v.value >= 0 && v.value <= 1 ? { type: "control", action: "volume", value: v.value } : null;
    case "settings": {
      if (!isObj(v.value)) return null;
      const patch: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v.value)) if (SETTING_KEYS.has(k)) patch[k] = val;
      return { type: "control", action: "settings", value: patch as Partial<Settings> };
    }
    default:
      return null;
  }
}

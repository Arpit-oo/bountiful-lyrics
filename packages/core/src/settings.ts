import { isHexColor } from "./color";

export const STYLE_IDS = ["constellation", "garden", "fisheye", "codestyle"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const FONT_IDS = ["jakarta", "dm", "serif", "bagel", "shrikhand", "marker", "anton", "fredoka", "gluten", "mono"] as const;
export type FontId = (typeof FONT_IDS)[number];

export const BACKGROUND_IDS = ["auto", "gradient", "cinematic", "ambient", "art", "grain", "sky", "black"] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export const DISPLAY_IDS = ["page", "fullscreen", "window"] as const;
export type DisplayId = (typeof DISPLAY_IDS)[number];

export const GLOW_ANIMATIONS = ["music", "orbit", "default", "idle", "none"] as const;
export type GlowAnimation = (typeof GLOW_ANIMATIONS)[number];

export interface Settings {
  style: StyleId;
  /** What sits behind the lyrics. "auto" picks the best match for the style. */
  background: BackgroundId;
  /** Where the Spotify plugin opens: inside the main view, fullscreen, or a pop-out window. */
  display: DisplayId;
  font: FontId;
  textScale: number;
  /** Shifts lyrics against the music, in ms. Positive shows them earlier, negative later. */
  lyricsOffsetMs: number;
  /** Constellation star size multiplier. */
  starScale: number;
  /** Constellation word size multiplier, on top of text size. */
  starTextScale: number;
  /** Fisheye and Codestyle: how much each lyric leans and bends, 0 = straight. */
  tilt: number;
  manualColors: boolean;
  lyricColor: string;
  highlightColor: string;
  secondaryColor: string;
  glowEnabled: boolean;
  glowColors: 1 | 2;
  glowAnimation: GlowAnimation;
  glowThickness: number;
  glowStrength: number;
  glowOverride: boolean;
  glowPrimary: string;
  glowSecondary: string;
  /** Colour of the moving light in Music Sync and Orbit. Auto takes a bright tint of the album. */
  glowLightAuto: boolean;
  glowLight: string;
  companion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  style: "fisheye",
  background: "auto",
  display: "page",
  font: "jakarta",
  textScale: 1,
  lyricsOffsetMs: 0,
  starScale: 1,
  starTextScale: 1,
  tilt: 0.5,
  manualColors: false,
  lyricColor: "#f4f1ea",
  highlightColor: "#ff9f43",
  secondaryColor: "#8f8fa6",
  glowEnabled: true,
  glowColors: 2,
  glowAnimation: "music",
  glowThickness: 3,
  glowStrength: 28,
  glowOverride: false,
  glowPrimary: "#8b5cf6",
  glowSecondary: "#ec4899",
  glowLightAuto: true,
  glowLight: "#ffffff",
  companion: true,
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);
const color = (value: unknown, fallback: string): string => (isHexColor(value) ? value : fallback);

/** Accepts untrusted stored or received data and returns complete, valid settings. */
export function sanitizeSettings(input: unknown): Settings {
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    style: oneOf(STYLE_IDS, v.style, d.style),
    // Older builds stored a boolean "visual" for the album art background.
    background: oneOf(BACKGROUND_IDS, v.background, v.visual === true ? "art" : d.background),
    display: oneOf(DISPLAY_IDS, v.display, d.display),
    font: oneOf(FONT_IDS, v.font, d.font),
    textScale: clamp(v.textScale, 0.6, 1.6, d.textScale),
    lyricsOffsetMs: clamp(v.lyricsOffsetMs, -1000, 1000, d.lyricsOffsetMs),
    starScale: clamp(v.starScale, 0.5, 2.5, d.starScale),
    starTextScale: clamp(v.starTextScale, 0.6, 2.4, d.starTextScale),
    tilt: clamp(v.tilt, 0, 1, d.tilt),
    manualColors: bool(v.manualColors, d.manualColors),
    lyricColor: color(v.lyricColor, d.lyricColor),
    highlightColor: color(v.highlightColor, d.highlightColor),
    secondaryColor: color(v.secondaryColor, d.secondaryColor),
    glowEnabled: bool(v.glowEnabled, d.glowEnabled),
    glowColors: v.glowColors === 1 ? 1 : 2,
    glowAnimation: oneOf(GLOW_ANIMATIONS, v.glowAnimation, d.glowAnimation),
    glowThickness: clamp(v.glowThickness, 1, 10, d.glowThickness),
    glowStrength: clamp(v.glowStrength, 0, 80, d.glowStrength),
    glowOverride: bool(v.glowOverride, d.glowOverride),
    glowPrimary: color(v.glowPrimary, d.glowPrimary),
    glowSecondary: color(v.glowSecondary, d.glowSecondary),
    glowLightAuto: bool(v.glowLightAuto, d.glowLightAuto),
    glowLight: color(v.glowLight, d.glowLight),
    companion: bool(v.companion, d.companion),
  };
}

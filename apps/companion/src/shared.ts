import type { StyleId } from "@bountiful/core";

export { CORE_CSS, DEFAULT_SETTINGS, FONT_CSS, PlaybackClock, Stage, type Settings } from "@bountiful/core";

/** Tray choice: a specific style, or null to follow Spotify's setting. */
export type StyleIdOverride = StyleId | null;

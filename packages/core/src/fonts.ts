import anton from "@fontsource/anton/files/anton-latin-400-normal.woff2";
import bagel from "@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2";
import marker from "@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2";
import shrikhand from "@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2";
import dm from "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2";
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2";
import fredoka from "@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2";
import gluten from "@fontsource-variable/gluten/files/gluten-latin-wght-normal.woff2";
import mono from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2";
import jakarta from "@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2";
import type { FontId } from "./settings";

// Single-weight display faces also claim the full weight range, so the browser uses them as drawn
// instead of faking a bold version.
const face = (family: string, url: string) =>
  `@font-face{font-family:"${family}";src:url(${url}) format("woff2");font-weight:100 900;font-display:swap}`;

export const FONT_CSS = [
  face("BL Jakarta", jakarta),
  face("BL DM", dm),
  face("BL Mono", mono),
  face("BL Serif", fraunces),
  face("BL Bagel", bagel),
  face("BL Shrikhand", shrikhand),
  face("BL Marker", marker),
  face("BL Anton", anton),
  face("BL Fredoka", fredoka),
  face("BL Gluten", gluten),
].join("");

export const FONT_STACKS: Record<FontId, string> = {
  jakarta: `"BL Jakarta", "Segoe UI", sans-serif`,
  dm: `"BL DM", "Segoe UI", sans-serif`,
  serif: `"BL Serif", Georgia, serif`,
  bagel: `"BL Bagel", "BL Jakarta", sans-serif`,
  shrikhand: `"BL Shrikhand", "BL Serif", serif`,
  marker: `"BL Marker", "BL Jakarta", sans-serif`,
  anton: `"BL Anton", "BL Jakarta", sans-serif`,
  fredoka: `"BL Fredoka", "BL Jakarta", sans-serif`,
  gluten: `"BL Gluten", "BL Jakarta", sans-serif`,
  mono: `"BL Mono", Consolas, monospace`,
};

export const FONT_LABELS: Record<FontId, string> = {
  jakarta: "Plus Jakarta Sans",
  dm: "DM Sans",
  serif: "Fraunces (serif)",
  bagel: "Bagel Fat One (bubbly)",
  shrikhand: "Shrikhand (retro script)",
  marker: "Permanent Marker (hand-drawn)",
  anton: "Anton (tall poster)",
  fredoka: "Fredoka (soft round)",
  gluten: "Gluten (playful)",
  mono: "JetBrains Mono",
};

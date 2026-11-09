export interface Palette {
  primary: string;
  secondary: string;
}

export const FALLBACK_PALETTE: Palette = { primary: "#d8d8e4", secondary: "#8f8fa6" };

type Rgb = [number, number, number];

function toHex([r, g, b]: Rgb): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function fromHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsv([r, g, b]: Rgb): Rgb {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h * 60, max === 0 ? 0 : d / max, max / 255];
}

function hsvToRgb([h, s, v]: Rgb): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

export function mix(a: string, b: string, t: number): string {
  const x = fromHex(a);
  const y = fromHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Spotify's lyric colours are signed ARGB integers. */
export function argbToHex(value: number): string {
  const n = value >>> 0;
  return toHex([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function vivid(rgb: Rgb): string {
  const [h, s, v] = rgbToHsv(rgb);
  return toHex(hsvToRgb([h, Math.max(s, 0.62), Math.max(v, 0.9)]));
}

const HUE_BUCKETS = 12;
const MIN_SATURATION = 0.18;
const HUE_SHIFT = 40;

/** Picks two distinct vivid hues from RGBA pixels. Near-greyscale art gets the neutral palette. */
export function paletteFromPixels(data: ArrayLike<number>): Palette {
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ score: 0, r: 0, g: 0, b: 0, n: 0 }));
  let colourful = 0;
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    total++;
    const rgb: Rgb = [data[i]!, data[i + 1]!, data[i + 2]!];
    const [h, s, v] = rgbToHsv(rgb);
    if (s < MIN_SATURATION || v < 0.15) continue;
    colourful++;
    const b = buckets[Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS]!;
    b.score += s * v;
    b.r += rgb[0];
    b.g += rgb[1];
    b.b += rgb[2];
    b.n++;
  }
  if (total === 0 || colourful / total < 0.04) return FALLBACK_PALETTE;

  const ranked = buckets
    .map((b, index) => ({ ...b, index }))
    .filter((b) => b.n > 0)
    .sort((a, b) => b.score - a.score);
  const top = ranked[0]!;
  const avg = (b: typeof top): Rgb => [b.r / b.n, b.g / b.n, b.b / b.n];
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), HUE_BUCKETS - Math.abs(a - b));
  // A nearby hue keeps the gradient clean; opposite hues blend to mud along the edge.
  const nearby = ranked.find((b) => {
    const d = distance(b.index, top.index);
    return d >= 1 && d <= 3;
  });
  const topRgb = avg(top);
  const [h, s, v] = rgbToHsv(topRgb);
  return {
    primary: vivid(topRgb),
    secondary: vivid(nearby ? avg(nearby) : hsvToRgb([(h + HUE_SHIFT) % 360, s, v])),
  };
}

/** A vivid colour across the wheel from `hex`, for accents that need contrast (garden vines). */
export function complement(hex: string, degrees = 200): string {
  const [h, s, v] = rgbToHsv(fromHex(hex));
  return toHex(hsvToRgb([(h + degrees) % 360, Math.max(s, 0.7), Math.max(v, 0.85)]));
}

/** True when a palette carries no real colour (greyscale art). */
export function isNeutral(palette: Palette): boolean {
  const [, s] = rgbToHsv(fromHex(palette.primary));
  return s < 0.15;
}

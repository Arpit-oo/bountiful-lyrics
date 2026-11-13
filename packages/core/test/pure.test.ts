import { describe, expect, it } from "vitest";
import { argbToHex, FALLBACK_PALETTE, paletteFromPixels } from "../src/color";
import { findStarted, flatten, type Line } from "../src/lyrics/model";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings";
import { formatCodeLine } from "../src/styles/codestyle";
import { buildGroups, planConstellation } from "../src/styles/constellation";
import { resolveBackground } from "../src/stage";
import { focusScale } from "../src/styles/fisheye";

const fill = (rgb: number[], n: number) => Array.from({ length: n }, () => [...rgb, 255]).flat();
const hue = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

describe("paletteFromPixels", () => {
  it("makes red art read as red", () => {
    const [r, g, b] = hue(paletteFromPixels(fill([200, 20, 30], 64)).primary);
    expect(r).toBeGreaterThan(g * 1.5);
    expect(r).toBeGreaterThan(b * 1.5);
  });

  it("uses a nearby second hue when the art has one", () => {
    const p = paletteFromPixels([...fill([30, 40, 230], 40), ...fill([140, 30, 230], 24)]);
    expect(hue(p.primary)[2]).toBeGreaterThan(150);
    expect(hue(p.secondary)[0]).toBeGreaterThan(hue(p.primary)[0]);
  });

  it("does not pair opposite hues", () => {
    const p = paletteFromPixels([...fill([230, 30, 30], 40), ...fill([30, 220, 40], 24)]);
    const [r, g] = hue(p.secondary);
    expect(p.secondary).not.toBe(p.primary);
    expect(r).toBeGreaterThan(g);
  });

  it("uses the neutral palette for greyscale art", () => {
    expect(paletteFromPixels(fill([120, 120, 120], 64))).toEqual(FALLBACK_PALETTE);
  });

  it("uses the neutral palette for fully transparent pixels", () => {
    expect(paletteFromPixels([200, 20, 30, 0])).toEqual(FALLBACK_PALETTE);
  });
});

describe("argbToHex", () => {
  it("converts Spotify's signed integers", () => {
    expect(argbToHex(-1)).toBe("#ffffff");
    expect(argbToHex(-16777216)).toBe("#000000");
  });
});

describe("sanitizeSettings", () => {
  it("fills defaults for junk input", () => {
    expect(sanitizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps ranges and rejects bad values", () => {
    const s = sanitizeSettings({ textScale: 99, style: "evil", lyricColor: "url(x)", glowStrength: -4 });
    expect(s.textScale).toBe(1.6);
    expect(s.style).toBe(DEFAULT_SETTINGS.style);
    expect(s.lyricColor).toBe(DEFAULT_SETTINGS.lyricColor);
    expect(s.glowStrength).toBe(0);
  });
});

describe("findStarted", () => {
  const items = [{ startMs: 100 }, { startMs: 200 }, { startMs: 300 }];
  it.each([[50, -1], [100, 0], [250, 1], [999, 2]])("position %i gives %i", (pos, idx) => {
    expect(findStarted(items, pos)).toBe(idx);
  });
  it("handles empty input", () => expect(findStarted([], 5)).toBe(-1));
});

describe("formatCodeLine", () => {
  it("records exact ranges for each word in every variant", () => {
    for (let seed = 0; seed < 5; seed++) {
      const { text, ranges } = formatCodeLine(["Off", "Black,", "Cadillac"], seed);
      expect(ranges.map(([a, b]) => text.slice(a, b))).toEqual(["off", "black", "cadillac"]);
    }
  });

  it("keeps a placeholder for punctuation-only tokens", () => {
    const { text, ranges } = formatCodeLine(["—"], 0);
    expect(text.slice(...ranges[0]!)).toBe("_");
  });
});

const line = (start: number, n: number): Line => ({
  text: "x",
  startMs: start,
  endMs: start + n * 300,
  timing: "estimated",
  words: Array.from({ length: n }, (_, i) => ({ text: `w${i}`, startMs: start + i * 300, endMs: start + (i + 1) * 300 })),
});

describe("buildGroups", () => {
  it("keeps every word exactly once and in order", () => {
    const words = flatten([line(0, 6), line(2000, 6), line(4000, 6)]);
    const out = buildGroups(words).flatMap((g) => g.words);
    expect(out).toEqual(words);
  });

  it("breaks on a long instrumental gap", () => {
    expect(buildGroups(flatten([line(0, 3), line(20000, 3)]))).toHaveLength(2);
  });

  it("caps group size", () => {
    buildGroups(flatten([line(0, 40)])).forEach((g) => expect(g.words.length).toBeLessThanOrEqual(16));
  });

  it("keeps short quick lines together instead of flashing a new constellation each line", () => {
    const quick = flatten([line(0, 5), line(1600, 5), line(3200, 5), line(4800, 5)]);
    const groups = buildGroups(quick);
    expect(groups.length).toBeLessThanOrEqual(2);
    groups.slice(0, -1).forEach((g) => expect(g.words.length).toBeGreaterThanOrEqual(7));
  });
});

describe("planConstellation", () => {
  const words = "I need that I need that kitty cat yeah I need that".split(" ");

  it("is deterministic and stays on screen", () => {
    const a = planConstellation(words, 42);
    expect(a).toEqual(planConstellation(words, 42));
    a.points.forEach((p) => {
      expect(p.x).toBeGreaterThan(0.04);
      expect(p.x).toBeLessThan(0.96);
      expect(p.y).toBeGreaterThan(0.12);
      expect(p.y).toBeLessThan(0.84);
    });
  });

  it("sends repeated words back to their star", () => {
    const { points, starOf } = planConstellation(words, 7);
    expect(starOf).toHaveLength(words.length);
    expect(starOf[3]).toBe(starOf[0]);
    expect(starOf[4]).toBe(starOf[1]);
    expect(points.length).toBe(new Set(words.map((w) => w.toLowerCase())).size);
  });

  it("keeps stars apart", () => {
    const { points } = planConstellation("one two three four five six seven eight nine ten eleven twelve".split(" "), 3, 16 / 9);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot((points[i]!.x - points[j]!.x) * (16 / 9), points[i]!.y - points[j]!.y);
        expect(d).toBeGreaterThan(0.06);
      }
    }
  });
});

describe("resolveBackground", () => {
  it("matches the style on auto and respects explicit choices", () => {
    expect(resolveBackground({ background: "auto", style: "constellation" }, false)).toBe("black");
    expect(resolveBackground({ background: "auto", style: "fisheye" }, false)).toBe("ambient");
    expect(resolveBackground({ background: "auto", style: "garden" }, false)).toBe("gradient");
    expect(resolveBackground({ background: "art", style: "constellation" }, false)).toBe("art");
    expect(resolveBackground({ background: "sky", style: "fisheye" }, true)).toBe("none");
  });
});

describe("sanitizeSettings migration", () => {
  it("maps the old album art toggle to the art background", () => {
    expect(sanitizeSettings({ visual: true }).background).toBe("art");
    expect(sanitizeSettings({ visual: false }).background).toBe("auto");
    expect(sanitizeSettings({ display: "window" }).display).toBe("window");
    expect(sanitizeSettings({ display: "nope" }).display).toBe("page");
  });

  it("leaves lyrics timing untouched by default and limits how far it can move", () => {
    expect(sanitizeSettings({}).lyricsOffsetMs).toBe(0);
    expect(sanitizeSettings({ lyricsOffsetMs: 150 }).lyricsOffsetMs).toBe(150);
    expect(sanitizeSettings({ lyricsOffsetMs: 9000 }).lyricsOffsetMs).toBe(1000);
    expect(sanitizeSettings({ lyricsOffsetMs: -9000 }).lyricsOffsetMs).toBe(-1000);
    expect(sanitizeSettings({ lyricsOffsetMs: "soon" }).lyricsOffsetMs).toBe(0);
  });
});

describe("focusScale", () => {
  it("keeps short words full size and shrinks long ones", () => {
    expect(focusScale(3)).toBe(1);
    expect(focusScale(14)).toBe(0.5);
    expect(focusScale(0)).toBe(1);
  });
});

describe("fisheye icons", () => {
  it("covers common lyric words, punctuation and dropped g's", async () => {
    const { iconFor } = await import("../src/styles/fisheye");
    for (const w of ["love,", "You", "me", "I", "time", "night", "smokin'", "runnin'", "king", "dead", "up", "down", "money", "drink", "Diamond!", "baby", "party"]) {
      expect(iconFor(w), w).toBeTruthy();
    }
    expect(iconFor("the")).toBeUndefined();
  });

  it("covers the newer word groups", async () => {
    const { iconFor } = await import("../src/styles/fisheye");
    for (const w of ["graph", "Charts", "winning", "plane", "rocket", "galaxy", "clouds", "breathe", "rainbow", "trees", "mountain", "cat", "dawg", "bird", "butterfly", "snake", "fish", "dinner", "coffee", "birthday", "sweet", "story", "write", "letter", "wedding", "mic", "guitar", "movie", "online", "game", "ballin'", "shot", "boom", "protect", "knife", "boat", "journey", "walkin'", "shades", "drip", "door", "window", "tomorrow", "train", "wake", "thinking", "said", "flag"]) {
      expect(iconFor(w), w).toBeTruthy();
    }
    // Every icon is our own constant SVG markup.
    expect(iconFor("graph")).toMatch(/^<svg viewBox="0 0 24 24" aria-hidden="true"><path /);
  });
});

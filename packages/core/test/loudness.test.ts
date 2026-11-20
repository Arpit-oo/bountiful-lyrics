import { describe, expect, it } from "vitest";
import { isShouted, scoreLoudness, type LoudSegment } from "../src/timing/loudness";

const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `line ${i}`, startMs: i * 2000, endMs: i * 2000 + 1800 }));

/** Four 500 ms slices per line at the given level, with a little wobble. */
const segs = (levels: number[], bright = (_i: number) => 0): LoudSegment[] =>
  levels.flatMap((db, i) => [0, 1, 2, 3].map((k) => ({ startMs: i * 2000 + k * 500, endMs: i * 2000 + k * 500 + 500, loudness: db - k * 0.3 + (i % 3) * 0.4, bright: bright(i) })));

describe("loudness scoring", () => {
  // Verses around -12 dB, a couple of screamed lines at -3 dB.
  const levels = Array.from({ length: 40 }, (_, i) => (i === 20 || i === 21 ? -3 : -12 + (i % 5) * 0.8));

  it("flags the screamed lines and nothing else at default strength", () => {
    const scores = scoreLoudness(lines(40), segs(levels));
    const shouted = levels.map((_, i) => i).filter((i) => isShouted(scores, i, 0.5));
    expect(shouted).toEqual([20, 21]);
  });

  it("never shouts at strength 0", () => {
    const scores = scoreLoudness(lines(40), segs(levels));
    expect(levels.some((_, i) => isShouted(scores, i, 0))).toBe(false);
  });

  it("leaves a flat song alone", () => {
    const scores = scoreLoudness(lines(30), segs(new Array(30).fill(-8)));
    expect(lines(30).some((_, i) => isShouted(scores, i, 1))).toBe(false);
  });

  it("does nothing without analysis", () => {
    const scores = scoreLoudness(lines(10), []);
    expect(isShouted(scores, 3, 1)).toBe(false);
  });

  it("caps how much of the song can shout", () => {
    // A loud second half: more than a fifth of the song is loud, but only a share gets caps.
    const half = Array.from({ length: 40 }, (_, i) => (i < 20 ? -14 + (i % 4) : -4 + (i % 4)));
    const scores = scoreLoudness(lines(40), segs(half));
    const count = half.filter((_, i) => isShouted(scores, i, 1)).length;
    expect(count).toBeLessThanOrEqual(Math.ceil(40 * 0.18) + 1);
  });

  it("uses harshness to break ties between equally loud lines", () => {
    const flat = Array.from({ length: 30 }, (_, i) => (i === 10 || i === 11 ? -4 : -12 + (i % 4)));
    const scores = scoreLoudness(lines(30), segs(flat, (i) => (i === 11 ? 80 : 0)));
    expect(scores.score[11]!).toBeGreaterThan(scores.score[10]!);
  });
});

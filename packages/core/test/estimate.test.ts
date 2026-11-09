import { describe, expect, it } from "vitest";
import { buildSyncedLyrics, estimateWords, tokenize, wordWeight } from "../src/timing/estimate";

describe("estimateWords", () => {
  it("is ordered, contiguous and stays inside the line", () => {
    const words = estimateWords("taking my time on my ride", 1000, 4000);
    expect(words).toHaveLength(6);
    expect(words[0]!.startMs).toBe(1000);
    words.forEach((w, i) => {
      expect(w.endMs).toBeGreaterThanOrEqual(w.startMs);
      if (i > 0) expect(w.startMs).toBe(words[i - 1]!.endMs);
    });
    expect(words[5]!.endMs).toBeLessThanOrEqual(4000);
  });

  it("gives longer words more time", () => {
    const [short, long] = estimateWords("go everywhere", 0, 2000);
    expect(long!.endMs - long!.startMs).toBeGreaterThan(short!.endMs - short!.startMs);
  });

  it("ends early when a line holds through an instrumental gap", () => {
    const words = estimateWords("oh yeah", 0, 30000);
    expect(words[1]!.endMs).toBeLessThan(3000);
  });

  it("handles a single word", () => {
    const words = estimateWords("hello", 500, 1500);
    expect(words).toHaveLength(1);
    expect(words[0]!.startMs).toBe(500);
    expect(words[0]!.endMs).toBeLessThanOrEqual(1500);
  });

  it("survives an inverted time range", () => {
    const words = estimateWords("a b", 5000, 4000);
    expect(words).toHaveLength(2);
    expect(words[1]!.endMs).toBeGreaterThanOrEqual(words[0]!.startMs);
  });

  it("returns nothing for blank text", () => {
    expect(estimateWords("   ", 0, 1000)).toEqual([]);
  });
});

describe("tokenize and wordWeight", () => {
  it("splits CJK per character", () => {
    expect(tokenize("愛してる")).toEqual(["愛", "し", "て", "る"]);
  });

  it("weights non-Latin scripts by length", () => {
    expect(wordWeight("मोहब्बत")).toBeGreaterThan(wordWeight("हाँ"));
  });

  it("adds a pause for punctuation", () => {
    expect(wordWeight("love,")).toBeGreaterThan(wordWeight("love"));
  });
});

describe("buildSyncedLyrics", () => {
  it("bounds a line by the following gap marker and drops the marker", () => {
    const out = buildSyncedLyrics(
      [{ startMs: 0, text: "one two" }, { startMs: 2000, text: "" }, { startMs: 9000, text: "three" }],
      "t",
      20000,
    );
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0]!.endMs).toBe(2000);
  });

  it("caps the last line at the track duration", () => {
    const out = buildSyncedLyrics([{ startMs: 18000, text: "end" }], "t", 19000);
    expect(out.lines[0]!.endMs).toBe(19000);
  });

  it("falls back when duration is unknown", () => {
    const out = buildSyncedLyrics([{ startMs: 1000, text: "end" }], "t", 0);
    expect(out.lines[0]!.endMs).toBe(6000);
  });

  it("drops bad timestamps", () => {
    const out = buildSyncedLyrics(
      [{ startMs: Number.NaN, text: "bad" }, { startMs: -5, text: "bad" }, { startMs: 10, text: "good" }],
      "t",
      5000,
    );
    expect(out.lines.map((l) => l.text)).toEqual(["good"]);
  });

  it("marks real word timing and keeps it", () => {
    const out = buildSyncedLyrics(
      [{ startMs: 0, text: "a b", words: [{ text: "a", startMs: 0 }, { text: "b", startMs: 400, endMs: 700 }] }, { startMs: 1000, text: "c" }],
      "t",
      5000,
    );
    expect(out.lines[0]!.timing).toBe("word");
    expect(out.lines[0]!.words).toEqual([
      { text: "a", startMs: 0, endMs: 400 },
      { text: "b", startMs: 400, endMs: 700 },
    ]);
    expect(out.lines[1]!.timing).toBe("estimated");
  });

  it("never produces a line ending before it starts when timestamps collide", () => {
    const out = buildSyncedLyrics([{ startMs: 1000, text: "a" }, { startMs: 1000, text: "b" }], "t", 9000);
    out.lines.forEach((l) => expect(l.endMs).toBeGreaterThan(l.startMs));
  });
});

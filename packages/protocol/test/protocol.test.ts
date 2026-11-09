import { describe, expect, it } from "vitest";
import { isAllowedArtUrl, parseMessage } from "../src/index";

const s = (v: unknown) => JSON.stringify(v);

describe("parseMessage", () => {
  it("accepts a valid clock", () => {
    expect(parseMessage(s({ type: "clock", positionMs: 10, playing: true }))).toEqual({ type: "clock", positionMs: 10, playing: true });
  });

  it("rejects malformed JSON, unknown types and wrong field types", () => {
    expect(parseMessage("{nope")).toBeNull();
    expect(parseMessage(s({ type: "exec", cmd: "calc" }))).toBeNull();
    expect(parseMessage(s({ type: "clock", positionMs: "1", playing: true }))).toBeNull();
  });

  it("rejects art from other hosts", () => {
    const base = { type: "track", title: "t", artist: "a", durationMs: 1, beats: [] };
    expect(parseMessage(s({ ...base, artUrl: "https://evil.example/x.png" }))).toBeNull();
    expect(parseMessage(s({ ...base, artUrl: "https://i.scdn.co/image/ab67" }))?.type).toBe("track");
    expect(parseMessage(s({ ...base, artUrl: null }))?.type).toBe("track");
  });

  it("rejects non-hex palette values", () => {
    expect(parseMessage(s({ type: "theme", palette: { primary: "url(x)", secondary: "#000000" } }))).toBeNull();
  });

  it("validates nested lyric structure and strips unknown fields", () => {
    const line = { text: "a", startMs: 0, endMs: 1, timing: "word", words: [{ text: "a", startMs: 0, endMs: 1, extra: "x" }] };
    const ok = parseMessage(s({ type: "lyrics", lyrics: { kind: "synced", source: "t", lines: [line] } }));
    expect(ok).toEqual({ type: "lyrics", lyrics: { kind: "synced", source: "t", lines: [{ ...line, words: [{ text: "a", startMs: 0, endMs: 1 }] }] } });
    expect(parseMessage(s({ type: "lyrics", lyrics: { kind: "synced", source: "t", lines: [{ text: 1 }] } }))).toBeNull();
    expect(parseMessage(s({ type: "lyrics", lyrics: null }))).toEqual({ type: "lyrics", lyrics: null });
  });

  it("rejects oversized payloads", () => {
    expect(parseMessage(s({ type: "lyrics", lyrics: { kind: "synced", source: "t", lines: new Array(2001).fill(0) } }))).toBeNull();
  });

  it("sanitizes settings", () => {
    const m = parseMessage(s({ type: "settings", settings: { textScale: 500 } }));
    expect(m?.type === "settings" && m.settings.textScale).toBe(1.6);
  });
});

describe("isAllowedArtUrl", () => {
  it("rejects lookalike hosts and traversal", () => {
    expect(isAllowedArtUrl("https://i.scdn.co.evil.com/image/ab")).toBe(false);
    expect(isAllowedArtUrl("https://i.scdn.co/image/../x")).toBe(false);
  });
});

describe("open message", () => {
  it("accepts the companion window request and nothing extra", async () => {
    const { parseMessage } = await import("../src/index");
    expect(parseMessage(JSON.stringify({ type: "open" }))).toEqual({ type: "open" });
    expect(parseMessage(JSON.stringify({ type: "open", evil: "<script>" }))).toEqual({ type: "open" });
  });
});

describe("parseControl", () => {
  it("accepts known remote commands with valid values only", async () => {
    const { parseControl } = await import("../src/index");
    expect(parseControl(JSON.stringify({ type: "control", action: "toggle" }))).toEqual({ type: "control", action: "toggle" });
    expect(parseControl(JSON.stringify({ type: "control", action: "seek", value: 1200 }))).toEqual({ type: "control", action: "seek", value: 1200 });
    expect(parseControl(JSON.stringify({ type: "control", action: "volume", value: 3 }))).toBeNull();
    expect(parseControl(JSON.stringify({ type: "control", action: "rm -rf" }))).toBeNull();
    expect(parseControl(JSON.stringify({ type: "control", action: "settings", value: { style: "garden", evil: 1 } }))).toEqual({ type: "control", action: "settings", value: { style: "garden" } });
  });
});

import { describe, expect, it } from "vitest";
import { cleanArtist, cleanTitle, isAllowedArt, parseByline, pickBest } from "../src/metadata";

describe("cleanTitle", () => {
  it("removes video decoration", () => {
    expect(cleanTitle("Payphone (Official Music Video)")).toBe("Payphone");
    expect(cleanTitle("Song [Lyric Video] (feat. Someone)")).toBe("Song");
  });
  it("keeps meaningful brackets", () => {
    expect(cleanTitle("Hello (Goodbye)")).toBe("Hello (Goodbye)");
  });
});

describe("artist and byline", () => {
  it("strips the Topic suffix", () => expect(cleanArtist("Maroon 5 - Topic")).toBe("Maroon 5"));
  it("reads a song byline", () => {
    expect(parseByline("Drake • Views • 2016")).toEqual({ artist: "Drake", album: "Views" });
  });
  it("does not treat view counts as an album", () => {
    expect(parseByline("Drake • 1.2B views • 9M likes")).toEqual({ artist: "Drake", album: "" });
  });
  it("handles an empty byline", () => expect(parseByline("")).toEqual({ artist: "", album: "" }));
});

describe("pickBest", () => {
  it("prefers timed lyrics at a matching length", () => {
    const plain = { duration: 200, plainLyrics: "x" };
    const timed = { duration: 204, syncedLyrics: "[00:01.00]x" };
    expect(pickBest([plain, timed], 200)).toBe(timed);
  });
  it("rejects results with a very different length", () => {
    expect(pickBest([{ duration: 300, syncedLyrics: "x" }], 200)).toBeNull();
  });
  it("ignores empty records", () => expect(pickBest([{ duration: 200 }], 200)).toBeNull());
});

describe("isAllowedArt", () => {
  it("allows known image hosts only", () => {
    expect(isAllowedArt("https://i.ytimg.com/vi/x/hq.jpg")).toBe(true);
    expect(isAllowedArt("https://lh3.googleusercontent.com/a=w120")).toBe(true);
    expect(isAllowedArt("https://i.ytimg.com.evil.example/x")).toBe(false);
    expect(isAllowedArt("http://i.ytimg.com/x")).toBe(false);
    expect(isAllowedArt("nonsense")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseLrc } from "../src/lyrics/lrc";

describe("parseLrc", () => {
  it("parses timestamps and ignores metadata", () => {
    const out = parseLrc("[ar:Someone]\n[00:12.50] hello there\n[01:02.345]next");
    expect(out).toEqual([
      { startMs: 12500, text: "hello there" },
      { startMs: 62345, text: "next" },
    ]);
  });

  it("expands repeated line tags and sorts them", () => {
    const out = parseLrc("[00:30.00][00:10.00]chorus");
    expect(out.map((l) => l.startMs)).toEqual([10000, 30000]);
  });

  it("keeps empty lines as gap markers", () => {
    const out = parseLrc("[00:01.00]a\n[00:05.00]\n[00:09.00]b");
    expect(out[1]).toEqual({ startMs: 5000, text: "" });
  });

  it("reads enhanced word tags and a trailing end tag", () => {
    const [line] = parseLrc("[00:12.00] <00:12.00> Hello <00:12.50> world <00:13.25>");
    expect(line!.text).toBe("Hello world");
    expect(line!.words).toEqual([
      { text: "Hello", startMs: 12000 },
      { text: "world", startMs: 12500, endMs: 13250 },
    ]);
  });

  it("treats malformed input as no lines", () => {
    expect(parseLrc("not lyrics\n[xx:yy]nope")).toEqual([]);
  });
});

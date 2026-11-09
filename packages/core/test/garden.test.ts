import { describe, expect, it } from "vitest";
import { complement, isNeutral } from "../src/color";
import { leafPath, rosePath, swirlPath, vine } from "../src/styles/garden";
import { rng } from "../src/styles/types";

describe("garden geometry", () => {
  it("draws closed rose heads that are deterministic per seed", () => {
    const a = rosePath(20, rng(5));
    expect(a).toBe(rosePath(20, rng(5)));
    expect(a.startsWith("M")).toBe(true);
    expect(a.endsWith("Z")).toBe(true);
    expect(a).not.toBe(rosePath(20, rng(6)));
  });

  it("keeps swirls inside the rose", () => {
    const nums = swirlPath(30, rng(2)).match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.max(...nums.map(Math.abs))).toBeLessThanOrEqual(30);
  });

  it("makes leaves and vines with a usable length", () => {
    expect(leafPath(10)).toMatch(/^M0 0Q/);
    const v = vine({ x: 0, y: 0 }, -Math.PI / 2, 100, rng(9));
    expect(v.d.startsWith("M0.0 0.0")).toBe(true);
    expect(v.length).toBeGreaterThan(100);
    v.leaves.forEach((leaf) => expect(leaf.len).toBeGreaterThan(0));
  });
});

describe("garden colours", () => {
  it("finds a contrasting vine colour and spots greyscale palettes", () => {
    expect(complement("#e8141f")).not.toBe("#e8141f");
    expect(isNeutral({ primary: "#d8d8e4", secondary: "#8f8fa6" })).toBe(true);
    expect(isNeutral({ primary: "#e64e52", secondary: "#e67357" })).toBe(false);
  });
});

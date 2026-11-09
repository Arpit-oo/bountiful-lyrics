import { beforeEach, describe, expect, it } from "vitest";
import { PlaybackClock } from "../src/timing/clock";

describe("PlaybackClock", () => {
  let t: number;
  let clock: PlaybackClock;

  beforeEach(() => {
    t = 1000;
    clock = new PlaybackClock(() => t);
  });

  it("advances while playing", () => {
    clock.sync(5000, true, true);
    t += 250;
    expect(clock.position()).toBe(5250);
  });

  it("holds while paused", () => {
    clock.sync(5000, false, true);
    t += 9000;
    expect(clock.position()).toBe(5000);
  });

  it("freezes at the reported position on pause", () => {
    clock.sync(0, true, true);
    t += 1000;
    clock.sync(1010, false);
    t += 500;
    expect(clock.position()).toBe(1010);
  });

  it("ignores small jitter so time never steps backward", () => {
    clock.sync(0, true, true);
    t += 1000;
    clock.sync(950, true);
    expect(clock.position()).toBe(1000);
  });

  it("jumps on a real seek", () => {
    clock.sync(0, true, true);
    t += 1000;
    clock.sync(60000, true);
    expect(clock.position()).toBe(60000);
  });

  it("resets on a forced track change even with tiny drift", () => {
    clock.sync(1000, true, true);
    t += 10;
    clock.sync(1000, true, true);
    expect(clock.position()).toBe(1000);
  });
});

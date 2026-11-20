import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings";
import { planChat, PLACES } from "../src/styles/chat";

const song = (n: number, gapMs = 3000) =>
  Array.from({ length: n }, (_, i) => ({ text: `line number ${i}`, startMs: i * gapMs, endMs: i * gapMs + gapMs - 400 }));

describe("planChat", () => {
  it("sends lines in runs of two or three per side", () => {
    const plan = planChat(song(60), 42);
    const runs: number[] = [];
    let last = -1;
    for (const slot of plan) {
      if (slot!.side === last) runs[runs.length - 1]!++;
      else runs.push(1);
      last = slot!.side;
    }
    // The final run may be cut short by the end of the song.
    for (const run of runs.slice(0, -1)) expect([2, 3]).toContain(run);
    expect(plan[0]!.side).toBe(0);
  });

  it("is stable for the same seed", () => {
    expect(planChat(song(30), 7)).toEqual(planChat(song(30), 7));
  });

  it("opens with a map card and spaces later cards 5 to 8 lines apart", () => {
    const plan = planChat(song(80), 3);
    expect(plan[0]!.card?.kind).toBe("map");
    const cards = plan.map((s, i) => (s?.card ? i : -1)).filter((i) => i >= 0);
    expect(cards.length).toBeGreaterThan(6);
    for (let k = 1; k < cards.length; k++) {
      const gap = cards[k]! - cards[k - 1]!;
      expect(gap).toBeGreaterThanOrEqual(5);
      expect(gap).toBeLessThanOrEqual(8);
    }
    for (const i of cards) expect(plan[i]!.card!.place).toBeLessThan(PLACES.length);
    // Every location card comes with its map; there are no bare location lines.
    for (const i of cards) expect(plan[i]!.card!.kind).toBe("map");
  });

  it("skips blank and instrumental lines", () => {
    const lines = song(6);
    lines[2]!.text = "";
    lines[4]!.text = "♪";
    const plan = planChat(lines, 1);
    expect(plan[2]).toBeNull();
    expect(plan[4]).toBeNull();
    expect(plan.filter(Boolean)).toHaveLength(4);
  });

  it("marks run positions so only run ends get tails", () => {
    const plan = planChat(song(20), 9).filter(Boolean);
    plan.forEach((slot, i) => {
      const prevSame = i > 0 && plan[i - 1]!.side === slot!.side;
      const nextSame = i < plan.length - 1 && plan[i + 1]!.side === slot!.side;
      const expected = prevSame ? (nextSame ? "mid" : "last") : nextSame ? "first" : "single";
      expect(slot!.pos).toBe(expected);
    });
  });
});

describe("planChat emoticons", () => {
  it("adds a few, never on cards, matched to the mood", () => {
    const lines = song(80).map((l, i) => ({ ...l, text: i % 2 ? "I miss you, I'm alone tonight" : "we dance all night, baby" }));
    const plan = planChat(lines, 11);
    const withEmote = plan.filter((s) => s?.emote);
    expect(withEmote.length).toBeGreaterThan(6);
    expect(withEmote.length).toBeLessThan(plan.length / 2.5);
    for (const s of withEmote) expect(s!.card).toBeNull();
    plan.forEach((s, i) => {
      if (!s?.emote) return;
      expect(i % 2 ? [":(", ":'(", ":/"] : [":)", ":D", "<3", ";)"]).toContain(s.emote);
    });
  });
});

describe("chat settings", () => {
  it("defaults to iMessage colours and repairs bad input", () => {
    expect(DEFAULT_SETTINGS.chatMeColor).toBe("#0a84ff");
    const s = sanitizeSettings({ style: "chat", chatMeColor: "blue", chatThemColor: "#123456", chatCards: "yes" });
    expect(s.style).toBe("chat");
    expect(s.chatMeColor).toBe(DEFAULT_SETTINGS.chatMeColor);
    expect(s.chatThemColor).toBe("#123456");
    expect(s.chatCards).toBe(true);
    expect(s.chatEffect).toBe(DEFAULT_SETTINGS.chatEffect);
    expect(sanitizeSettings({ chatEffect: 4 }).chatEffect).toBe(1);
    expect(sanitizeSettings({ chatEffect: 0 }).chatEffect).toBe(0);
  });
});

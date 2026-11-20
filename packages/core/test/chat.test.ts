import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings";
import { planChat, PLACES } from "../src/styles/chat";
import { findSticker, STICKERS } from "../src/styles/stickers";

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

describe("planChat stickers and tapbacks", () => {
  const words = (text: string) => text.split(" ").map((t) => ({ text: t }));
  const lyric = ["driving home tonight in my car", "the roses on the table", "nothing much happening here", "why do you call me", "I love you so"];
  const lines = song(90).map((l, i) => {
    const text = lyric[i % lyric.length]!;
    return { ...l, text, words: words(text) };
  });

  it("picks stickers from words, spaced out and never on cards", () => {
    const plan = planChat(lines, 5);
    const at = plan.map((s, i) => (s?.sticker ? i : -1)).filter((i) => i >= 0);
    expect(at.length).toBeGreaterThan(5);
    for (let k = 1; k < at.length; k++) expect(at[k]! - at[k - 1]!).toBeGreaterThanOrEqual(4);
    for (const i of at) {
      const slot = plan[i]!;
      expect(slot.card).toBeNull();
      const def = STICKERS[slot.sticker!.id]!;
      // The trigger word really calls up that sticker.
      expect(def.words).toContain(lines[i]!.words[slot.sticker!.word]!.text.toLowerCase());
    }
    // Not the same sticker twice in a row.
    for (let k = 1; k < at.length; k++) expect(plan[at[k]!]!.sticker!.id).not.toBe(plan[at[k - 1]!]!.sticker!.id);
  });

  it("finds the first matching word", () => {
    expect(findSticker(["Take", "me", "home,", "country", "roads"])).toEqual({ sticker: STICKERS.findIndex((s) => s.id === "house"), word: 2 });
    expect(findSticker(["nothing", "here"])).toBeNull();
  });

  it("adds tapbacks that fit the line, never with a corner sticker", () => {
    const plan = planChat(lines, 8);
    const taps = plan.map((s, i) => (s?.tapback ? i : -1)).filter((i) => i >= 0);
    expect(taps.length).toBeGreaterThan(4);
    for (const i of taps) {
      expect(plan[i]!.card).toBeNull();
      expect(plan[i]!.sticker?.mode).not.toBe("peel");
      if (lines[i]!.text.startsWith("why")) expect(plan[i]!.tapback).toBe("ask");
    }
  });

  it("has a sticker toggle that defaults on", () => {
    expect(DEFAULT_SETTINGS.chatStickers).toBe(true);
    expect(sanitizeSettings({ chatStickers: false }).chatStickers).toBe(false);
    expect(sanitizeSettings({ chatStickers: "x" }).chatStickers).toBe(true);
  });
});

describe("chat toggles", () => {
  it("keeps reactions and emoticons on by default and lets them be turned off", () => {
    expect(DEFAULT_SETTINGS.chatReactions).toBe(true);
    expect(DEFAULT_SETTINGS.chatEmotes).toBe(true);
    const s = sanitizeSettings({ chatReactions: false, chatEmotes: false, chatStickers: false });
    expect([s.chatReactions, s.chatEmotes, s.chatStickers]).toEqual([false, false, false]);
  });

  it("has stickers for weapons, nature and places", () => {
    for (const word of ["shotgun", "gun", "sword", "sun", "planet", "ocean", "road", "mountain", "tree", "plants"]) {
      expect(findSticker([word]), word).not.toBeNull();
    }
  });
});

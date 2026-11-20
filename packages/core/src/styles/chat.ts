import { findStarted, type Line, type SyncedLyrics } from "../lyrics/model";
import { isShouted, scoreLoudness, type LoudScores, type LoudSegment } from "../timing/loudness";
import { findSticker, STICKERS } from "./stickers";
import { el, hash, reducedMotion, rng, type Renderer } from "./types";

/** 0 = them (left, dark bubbles), 1 = me (right, blue bubbles). */
export type ChatSide = 0 | 1;
export type ChatCard = { kind: "map"; place: number };

export interface ChatSlot {
  side: ChatSide;
  /** Where the bubble sits in its run of same-side messages. Only the last one gets a tail. */
  pos: "single" | "first" | "mid" | "last";
  card: ChatCard | null;
  /** A text-style emoticon tacked onto the end of the message, like a real text. */
  emote: string | null;
  /**
   * A big sticker called up by a word in the line. `word` is the word that triggers it;
   * "solo" sends it as its own message, "peel" slaps it onto the bubble's corner.
   */
  sticker: { id: number; word: number; mode: "solo" | "peel" } | null;
  /** An iMessage-style reaction the other person leaves on this bubble once it's sent. */
  tapback: Tapback | null;
}

export type Tapback = "heart" | "like" | "haha" | "bang" | "ask";

export const PLACES: ReadonlyArray<readonly [string, string]> = [
  ["Statue of Liberty", "New York"],
  ["Brooklyn Bridge", "New York"],
  ["Central Park", "New York"],
  ["Times Square", "New York"],
  ["Shibuya Crossing", "Tokyo"],
  ["Harajuku", "Tokyo"],
  ["Santa Monica Pier", "Los Angeles"],
  ["Sunset Blvd", "Los Angeles"],
  ["Venice Beach", "Los Angeles"],
  ["Golden Gate Bridge", "San Francisco"],
  ["Eiffel Tower", "Paris"],
  ["Le Marais", "Paris"],
  ["Abbey Road", "London"],
  ["Shoreditch", "London"],
  ["Marine Drive", "Mumbai"],
  ["Bandra Bandstand", "Mumbai"],
  ["Hauz Khas", "New Delhi"],
  ["Gangnam", "Seoul"],
  ["Bondi Beach", "Sydney"],
  ["South Beach", "Miami"],
  ["Bourbon Street", "New Orleans"],
  ["Navy Pier", "Chicago"],
  ["Copacabana", "Rio de Janeiro"],
  ["Trastevere", "Rome"],
  ["Kreuzberg", "Berlin"],
  ["Nyhavn", "Copenhagen"],
  ["Dubai Marina", "Dubai"],
  ["Kensington Market", "Toronto"],
  ["Old Fourth Ward", "Atlanta"],
  ["Lake Shore Drive", "Chicago"],
];

const HAPPY = /\b(love|loving|smile|smiling|happy|laugh|laughing|baby|sweet|kiss|good|fun|dance|dancing|beautiful|pretty|crazy|party|yeah|best|shine|sun|sunshine)\b/i;
const SAD = /\b(cry|crying|tears|sad|alone|lonely|hurt|hurts|pain|miss|missing|gone|lost|broken|break|die|dying|goodbye|sorry|cold|dark|never|fall|falling|leave|left)\b/i;
const EMOTES = { happy: [":)", ":D", "<3", ";)"], sad: [":(", ":'(", ":/"], other: [":)", ";)", ":P", "xD", ":o", "^_^"] };

const QUESTION = /\?|^\s*(why|what|how|where|who|when|do you|are you|can you|will you|would you)\b/i;

/** Picks a reaction that fits the line: a question gets "?", a shout "!!", feelings a heart or a laugh. */
function pickTapback(text: string, rand: () => number): Tapback {
  if (QUESTION.test(text)) return "ask";
  if (/!/.test(text) || (text === text.toUpperCase() && /[A-Z]{3}/.test(text))) return "bang";
  if (SAD.test(text)) return "heart";
  if (HAPPY.test(text)) return rand() < 0.5 ? "haha" : "heart";
  return rand() < 0.6 ? "like" : "heart";
}

/** A pause this long between lines reads like the conversation went quiet, so the next run can start. */
const PAUSE_MS = 5000;

const isBlank = (line: Pick<Line, "text">): boolean => !line.text.trim() || /^[♪♫♩♬\s.…-]+$/u.test(line.text);

/**
 * Decides who "sends" each line and which lines become location cards.
 * Same seed, same conversation, so a song always plays out the same way.
 */
export function planChat(lines: Array<Pick<Line, "text" | "startMs" | "endMs"> & { words?: Array<{ text: string }> }>, seed: number): Array<ChatSlot | null> {
  const rand = rng(seed);
  const out: Array<ChatSlot | null> = [];
  let side: ChatSide = 0;
  let left = 2 + Math.floor(rand() * 2);
  let untilCard = 0;
  let untilEmote = 3 + Math.floor(rand() * 3);
  let untilSticker = 1 + Math.floor(rand() * 2);
  let untilTap = 4 + Math.floor(rand() * 3);
  const recent: number[] = [];
  let lastPlace = -1;
  let prevEnd = Number.NEGATIVE_INFINITY;
  let first = true;
  for (const line of lines) {
    if (isBlank(line)) {
      out.push(null);
      continue;
    }
    if (!first) {
      // A long silence ends a run early, but never leaves a lone message.
      const pause = line.startMs - prevEnd >= PAUSE_MS && left < 2;
      if (left <= 0 || pause) {
        side = side === 0 ? 1 : 0;
        left = 2 + Math.floor(rand() * 2);
      }
    }
    left--;
    let card: ChatCard | null = null;
    if (untilCard <= 0) {
      let place = Math.floor(rand() * PLACES.length);
      if (place === lastPlace) place = (place + 1) % PLACES.length;
      lastPlace = place;
      card = { kind: "map", place };
      untilCard = 5 + Math.floor(rand() * 4);
    }
    untilCard--;
    // Now and then a message ends with an emoticon, picked to match the mood of the words.
    let emote: string | null = null;
    untilEmote--;
    const mood = SAD.test(line.text) ? "sad" : HAPPY.test(line.text) ? "happy" : "other";
    if (!card && (untilEmote <= 0 || (mood !== "other" && untilEmote <= 2 && rand() < 0.5))) {
      const pool = EMOTES[mood];
      emote = pool[Math.floor(rand() * pool.length)]!;
      untilEmote = 4 + Math.floor(rand() * 5);
    }
    // Stickers: only when a word in the line has one, and not too often, and never the same one twice in a row.
    let sticker: ChatSlot["sticker"] = null;
    untilSticker--;
    if (!card && untilSticker <= 0) {
      const timed = Boolean(line.words?.length);
      const tokens = timed ? line.words!.map((w) => w.text) : line.text.split(/\s+/);
      const hit = findSticker(tokens, new Set(recent));
      if (hit) {
        sticker = { id: hit.sticker, word: timed ? hit.word : 0, mode: rand() < 0.45 ? "solo" : "peel" };
        recent.push(hit.sticker);
        if (recent.length > 4) recent.shift();
        untilSticker = 4 + Math.floor(rand() * 4);
      }
    }
    // Tapbacks: the other person reacts to a line now and then. They share the corner with peel stickers, so not both.
    let tapback: Tapback | null = null;
    untilTap--;
    if (!card && sticker?.mode !== "peel" && untilTap <= 0) {
      tapback = pickTapback(line.text, rand);
      untilTap = 7 + Math.floor(rand() * 5);
    }
    out.push({ side, pos: "single", card, emote, sticker, tapback });
    prevEnd = line.endMs;
    first = false;
  }
  // Mark run positions so only the last bubble of a run carries the tail.
  const filled = out.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  filled.forEach((index, k) => {
    const slot = out[index]!;
    const prev = k > 0 ? out[filled[k - 1]!]! : null;
    const next = k < filled.length - 1 ? out[filled[k + 1]!]! : null;
    const joinPrev = prev?.side === slot.side;
    const joinNext = next?.side === slot.side;
    slot.pos = joinPrev ? (joinNext ? "mid" : "last") : joinNext ? "first" : "single";
  });
  return out;
}

// ---------- Small drawings ----------

const ICONS = [
  // car
  "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm2.2-1h9.6l-1-3H8.2zM7.5 14a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm9 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z",
  // landmark
  "M12 3l9 4.5V9H3V7.5zM5 10h2v7H5zm4 0h2v7H9zm4 0h2v7h-2zm4 0h2v7h-2zM3 18h18v2H3z",
  // heart
  "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  // star
  "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  // music
  "M9 17.5V6l11-2v11.5a2.5 2.5 0 1 1-2-2.45V7.4l-7 1.3v8.8a2.5 2.5 0 1 1-2-2.45z",
  // cup
  "M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zm13 1h1.5a2.5 2.5 0 0 1 0 5H17v-1.5h1.5a1 1 0 0 0 0-2H17zM3 19h15v1.5H3z",
];

const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.5l7.6 2.9L13.5 21z"/></svg>`;
const TXT = (t: string, size: number, y: number) => `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="${y}" text-anchor="middle" font-size="${size}" font-weight="900" font-family="system-ui,sans-serif" fill="currentColor">${t}</text></svg>`;
const TAPBACK_GLYPHS: Record<Tapback, string> = {
  heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5-8-11.3A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 3.1C20 16 12 21 12 21z" fill="currentColor"/></svg>`,
  like: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21h4V9H2zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10a2 2 0 0 0 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7z" fill="currentColor"/></svg>`,
  haha: `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="11" text-anchor="middle" font-size="9.5" font-weight="900" font-family="system-ui,sans-serif" fill="currentColor">HA</text><text x="12" y="21" text-anchor="middle" font-size="9.5" font-weight="900" font-family="system-ui,sans-serif" fill="currentColor">HA</text></svg>`,
  bang: TXT("!!", 19, 19.5),
  ask: TXT("?", 21, 20),
};
const PIN_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`;

/** A stylised street map strip, generated from a seed. Purely decorative, nothing is fetched. */
export function mapSvg(seed: number): string {
  const r = rng(seed);
  const n = (min: number, max: number) => Math.round(min + r() * (max - min));
  const parts: string[] = [];
  // Water or a park along one side.
  if (r() < 0.55) {
    const y = n(55, 80);
    parts.push(`<path d="M0 ${y} C 80 ${y - n(10, 25)}, 160 ${y + n(5, 20)}, 320 ${y - n(0, 20)} V100 H0Z" fill="#232c66"/>`);
  } else {
    parts.push(`<ellipse cx="${n(30, 290)}" cy="${n(10, 90)}" rx="${n(30, 60)}" ry="${n(14, 26)}" fill="#2b4a5c" opacity=".8"/>`);
  }
  // City blocks.
  for (let i = 0; i < 9; i++) {
    parts.push(`<rect x="${n(0, 300)}" y="${n(0, 85)}" width="${n(14, 40)}" height="${n(8, 22)}" rx="2" fill="#3b3884" opacity="${(0.5 + r() * 0.4).toFixed(2)}" transform="rotate(${n(-25, 25)} 160 50)"/>`);
  }
  // Streets: a grid at a random angle and one main road.
  const angle = n(-35, 35);
  const grid: string[] = [];
  for (let x = -60; x < 380; x += n(34, 56)) grid.push(`M${x} -60V160`);
  for (let y = -40; y < 140; y += n(26, 40)) grid.push(`M-60 ${y}H380`);
  parts.push(`<path d="${grid.join("")}" stroke="#5753b0" stroke-width="2.2" fill="none" transform="rotate(${angle} 160 50)"/>`);
  parts.push(`<path d="M-10 ${n(10, 90)} Q 160 ${n(-20, 120)} 330 ${n(10, 90)}" stroke="#8c88dd" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  const icon = ICONS[n(0, ICONS.length - 1)]!;
  // The pin, centred like a dropped location.
  parts.push(
    `<g transform="translate(160 44)"><path d="M0 22 -7 10h14z" fill="#7d93c9"/><circle r="17" fill="#7d93c9" stroke="#c9d6f5" stroke-width="2"/><g transform="translate(-10 -10) scale(.84)"><path d="${icon}" fill="#eaf0ff"/></g></g>`,
  );
  return `<svg viewBox="0 0 320 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="100" fill="#2e2b72"/>${parts.join("")}</svg>`;
}

// ---------- Renderer ----------

const KEEP = 9;
const TYPING_LEAD_MS = 2600;
const TYPING_MIN_GAP_MS = 1400;

const EASE = "cubic-bezier(.16,1,.3,1)";

interface Msg {
  index: number;
  root: HTMLElement;
  bubble: HTMLElement;
  /** Word spans in order; the emoticon, when there is one, is the last entry. */
  words: HTMLElement[];
  emote: boolean;
  shown: number;
  loud: boolean;
  sticker: { box: HTMLElement; word: number; shown: boolean } | null;
  tapback: { node: HTMLElement; shown: boolean } | null;
}

export class ChatRenderer implements Renderer {
  private readonly wrap: HTMLElement;
  private readonly thread: HTMLElement;
  private readonly typing: HTMLElement;
  private readonly status: HTMLElement;
  private lines: Line[] = [];
  private plan: Array<ChatSlot | null> = [];
  private msgs: Msg[] = [];
  private current = -2;
  private typingFor = -1;
  private segments: LoudSegment[] = [];
  private loud: LoudScores = { score: [], rank: [] };

  constructor(root: HTMLElement) {
    this.wrap = el("div", "bl-chat", root);
    // A slow float on a separate layer, so it never fights the thread's own slide animations.
    this.thread = el("div", "bl-chat-thread", el("div", "bl-chat-drift", this.wrap));
    this.typing = el("div", "bl-chat-msg bl-chat-typing");
    const dots = el("div", "bl-chat-bubble", this.typing);
    for (let i = 0; i < 3; i++) el("i", "", dots);
    this.status = el("div", "bl-chat-status");
    this.status.textContent = "Delivered";
  }

  setLyrics(lyrics: SyncedLyrics): void {
    this.lines = lyrics.lines;
    this.plan = planChat(lyrics.lines, hash(lyrics.lines.map((l) => l.text).join("\n")));
    this.loud = scoreLoudness(this.lines, this.segments);
    this.current = -2;
    this.typingFor = -1;
    this.clear();
  }

  setLoudness(segments: LoudSegment[]): void {
    this.segments = segments;
    this.loud = scoreLoudness(this.lines, segments);
  }

  /** Shout strength from settings: 0 = never shout, 1 = shout readily. */
  private shout(): number {
    const v = Number.parseFloat(getComputedStyle(this.wrap).getPropertyValue("--bl-chat-shout"));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  }

  private clear(): void {
    this.msgs = [];
    this.thread.replaceChildren();
  }

  /** Index of the last started line that actually has a bubble. */
  private lastSlot(positionMs: number): number {
    for (let i = findStarted(this.lines, positionMs); i >= 0; i--) if (this.plan[i]) return i;
    return -1;
  }

  private nextSlot(after: number): number {
    for (let i = after + 1; i < this.plan.length; i++) if (this.plan[i]) return i;
    return -1;
  }

  update(positionMs: number): void {
    const index = this.lastSlot(positionMs);
    if (index !== this.current) {
      const prevNext = this.nextSlot(this.current);
      if (index >= 0 && this.current >= -1 && index === prevNext) this.push(index);
      else this.rebuild(index, positionMs);
      this.current = index;
    }
    const last = this.msgs[this.msgs.length - 1];
    if (last && last.index === index) this.reveal(last, positionMs, true);
    this.updateTapbacks(positionMs, true);
    this.updateTyping(index, positionMs);
  }

  // ---- Building ----

  private build(index: number): Msg {
    const slot = this.plan[index]!;
    const line = this.lines[index]!;
    const root = el("div", "bl-chat-msg");
    root.dataset.side = slot.side ? "me" : "them";
    root.dataset.pos = slot.pos;
    // Lines sung far louder than the rest of the song come in ALL CAPS, like a shouted text.
    const loud = isShouted(this.loud, index, this.shout());
    if (loud) root.classList.add("bl-chat-loud");
    const bubble = el("div", "bl-chat-bubble", root);
    let textHost = bubble;
    if (slot.card) {
      const [name, city] = PLACES[slot.card.place]!;
      bubble.classList.add("bl-chat-card");
      bubble.dataset.kind = slot.card.kind;
      // Every location card carries its map, like a real shared location.
      const map = el("div", "bl-chat-map", bubble);
      map.innerHTML = mapSvg(hash(`${index}:${line.text}`)); // Generated markup, no lyric text inside.
      const label = el("span", "bl-chat-map-label", map);
      label.innerHTML = PIN_GLYPH; // Constant markup only.
      label.append("Maps");
      const body = el("div", "bl-chat-card-body", bubble);
      textHost = el("div", "bl-chat-card-title", body);
      const place = el("div", "bl-chat-card-place", body);
      place.innerHTML = ARROW; // Constant markup only.
      place.append(`${name}, ${city}`);
    }
    const words: HTMLElement[] = [];
    const source = line.words.length ? line.words.map((w) => w.text) : [line.text];
    if (slot.emote) source.push(slot.emote);
    source.forEach((text, i) => {
      if (i > 0) textHost.append(" ");
      const w = el("span", "bl-chat-w", textHost);
      w.textContent = text;
      w.hidden = true;
      words.push(w);
    });
    if (slot.emote) words[words.length - 1]!.classList.add("bl-chat-emote");
    let sticker: Msg["sticker"] = null;
    if (slot.sticker) {
      const def = STICKERS[slot.sticker.id]!;
      const box = el("div", "bl-chat-sticker", slot.sticker.mode === "peel" ? bubble : root);
      box.dataset.mode = slot.sticker.mode;
      box.dataset.motion = def.motion;
      const img = el("img", "", box) as HTMLImageElement;
      img.src = def.url;
      img.alt = "";
      img.draggable = false;
      box.hidden = true;
      root.classList.add(`bl-chat-has-${slot.sticker.mode}`);
      const lastWord = words.length - (slot.emote ? 2 : 1);
      sticker = { box, word: Math.max(0, Math.min(slot.sticker.word, lastWord)), shown: false };
    }
    let tapback: Msg["tapback"] = null;
    if (slot.tapback && !slot.card) {
      const node = el("div", "bl-chat-tapback", bubble);
      node.dataset.kind = slot.tapback;
      node.innerHTML = TAPBACK_GLYPHS[slot.tapback]; // Constant markup only.
      node.hidden = true;
      root.classList.add("bl-chat-has-tap");
      tapback = { node, shown: false };
    }
    return { index, root, bubble, words, emote: Boolean(slot.emote), shown: 0, loud, sticker, tapback };
  }

  /**
   * Fixes the bubble at the width of the whole line before any word shows, like the reference:
   * the bubble only grows downward as lines wrap, so words never land outside it.
   * Stored in em so it follows the text size.
   */
  private lockWidth(msg: Msg): void {
    msg.words.forEach((w) => (w.hidden = false));
    msg.bubble.style.width = "";
    const px = msg.bubble.getBoundingClientRect().width;
    const font = Number.parseFloat(getComputedStyle(msg.bubble).fontSize) || 16;
    if (px > 0) msg.bubble.style.width = `${((Math.ceil(px) + 1) / font).toFixed(3)}em`;
    msg.words.forEach((w) => (w.hidden = true));
    msg.shown = 0;
  }

  private visibleCount(msg: Msg, positionMs: number): number {
    const line = this.lines[msg.index]!;
    const words = line.words;
    if (!words.length) return msg.words.length;
    const sung = Math.max(1, findStarted(words, positionMs) + 1);
    if (!msg.emote) return sung;
    // The emoticon lands just after the last word is sung.
    const last = words[words.length - 1]!;
    return sung >= words.length && positionMs >= Math.min(last.endMs, line.endMs) ? sung + 1 : sung;
  }

  /** Effect strength from settings, 0 = a plain fade, 1 = a big swirl. */
  private fx(): number {
    const v = Number.parseFloat(getComputedStyle(this.wrap).getPropertyValue("--bl-chat-fx"));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  }

  /** Shows the words sung so far. `animate` grows the bubble downward and fades the new words in. */
  private reveal(msg: Msg, positionMs: number, animate: boolean): void {
    const count = this.visibleCount(msg, positionMs);
    if (count === msg.shown) return;
    const anim = animate && !reducedMotion();
    const motion = anim && msg.shown > 0 && count > msg.shown;
    const fromH = motion ? msg.bubble.getBoundingClientRect().height : 0;
    const threadFrom = anim ? this.thread.offsetHeight : 0;
    msg.words.forEach((w, i) => (w.hidden = i >= count));
    const before = msg.shown;
    msg.shown = count;
    // The sticker lands the moment its word is sung.
    const sticker = msg.sticker && !msg.sticker.shown && count > msg.sticker.word ? msg.sticker : null;
    if (sticker) {
      sticker.shown = true;
      sticker.box.hidden = false;
      if (anim) this.slap(sticker.box, 0);
    }
    if (count >= msg.words.length) this.placeStatus();
    if (!motion) {
      if (sticker && anim) this.slideThread(threadFrom);
      return;
    }
    const toH = msg.bubble.getBoundingClientRect().height;
    if (Math.abs(toH - fromH) > 0.5) {
      // Clip top and bottom while the bubble opens a new row; the sides stay free for the tail.
      msg.bubble.style.clipPath = "inset(-3em -3em 0 -3em)";
      const grow = msg.bubble.animate([{ height: `${fromH}px` }, { height: `${toH}px` }], { duration: 260, easing: EASE });
      grow.onfinish = grow.oncancel = () => (msg.bubble.style.clipPath = "");
    }
    this.slideThread(threadFrom);
    const f = this.fx();
    for (let i = before; i < count; i++) {
      const emote = msg.emote && i === msg.words.length - 1;
      // Words spiral in from below-left; strength scales the turn, travel, blur and shrink.
      const from = emote
        ? { opacity: 0, transform: `scale(${(1 - 0.7 * f).toFixed(2)}) rotate(${-40 * f}deg)` }
        : { opacity: 0, filter: `blur(${(0.05 + 0.25 * f).toFixed(2)}em)`, transform: `translate(${(-0.45 * f).toFixed(2)}em, ${(0.12 + 0.55 * f).toFixed(2)}em) rotate(${(-38 * f).toFixed(1)}deg) scale(${(1 - 0.45 * f).toFixed(2)})` };
      msg.words[i]!.animate([from, { opacity: 1, filter: "blur(0)", transform: "none" }], { duration: Math.round((emote ? 380 : 260) + 380 * f), delay: (i - before) * 70, fill: "backwards", easing: EASE });
    }
    // The bubble gives a tiny nudge with each word, so it feels like it's being typed live.
    const nudge = msg.loud ? 0.06 + 0.04 * f : 0.035 * f;
    if (nudge > 0) msg.root.animate([{ transform: "scale(1)" }, { transform: `scale(${(1 + nudge).toFixed(3)})`, offset: 0.35 }, { transform: "scale(1)" }], { duration: 360, easing: "ease-out" });
  }

  /** iMessage's "Loud" effect: the bubble lands huge, snaps down to size and shakes the screen. */
  private slam(msg: Msg): void {
    msg.bubble.animate(
      [
        { opacity: 0, scale: "2.3" },
        { opacity: 1, scale: "0.94", offset: 0.32 },
        { scale: "1.05", translate: "-.1em 0", offset: 0.46 },
        { scale: "1", translate: ".1em 0", offset: 0.58 },
        { translate: "-.06em 0", offset: 0.7 },
        { translate: ".03em 0", offset: 0.82 },
        { opacity: 1, scale: "1", translate: "0 0" },
      ],
      { duration: 760, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
    this.wrap.animate(
      [{ translate: "0 0" }, { translate: ".07em .03em", offset: 0.3 }, { translate: "-.06em -.02em", offset: 0.5 }, { translate: ".03em 0", offset: 0.7 }, { translate: "0 0" }],
      { duration: 420, delay: 200 },
    );
  }

  /** A sticker smacks down from above, overshoots a little, and settles. */
  private slap(box: HTMLElement, delay: number): void {
    const f = this.fx();
    box.animate(
      [
        { opacity: 0, scale: `${(1.6 + 0.8 * f).toFixed(2)}`, translate: `0 ${(-0.3 - 0.6 * f).toFixed(2)}em` },
        { opacity: 1, scale: "0.9", translate: "0 0", offset: 0.55 },
        { opacity: 1, scale: "1.04", offset: 0.8 },
        { opacity: 1, scale: "1", translate: "0 0" },
      ],
      { duration: 520, delay, fill: "backwards", easing: "cubic-bezier(.2,.8,.3,1)" },
    );
  }

  /** The other person reacts a beat after a line is sent; older lines already carry theirs. */
  private updateTapbacks(positionMs: number, animate: boolean): void {
    const last = this.msgs[this.msgs.length - 1];
    for (const msg of this.msgs) {
      const tap = msg.tapback;
      if (!tap || tap.shown) continue;
      if (msg === last && (msg.shown < msg.words.length || positionMs < this.lines[msg.index]!.endMs + 450)) continue;
      tap.shown = true;
      tap.node.hidden = false;
      if (animate && !reducedMotion()) {
        tap.node.animate(
          [{ opacity: 0, scale: "0", rotate: "-25deg" }, { opacity: 1, scale: "1.18", rotate: "6deg", offset: 0.6 }, { opacity: 1, scale: "1", rotate: "0deg" }],
          { duration: 460, easing: "cubic-bezier(.2,.8,.3,1)" },
        );
      }
    }
  }

  private measure(node: HTMLElement): { w: number; h: number } {
    const r = node.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  /** Older messages glide up instead of jumping when the thread grows. */
  private slideThread(fromHeight: number): void {
    const delta = this.thread.offsetHeight - fromHeight;
    if (!delta || reducedMotion()) return;
    this.thread.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], { duration: 340, easing: "cubic-bezier(.16,1,.3,1)" });
  }

  private push(index: number): void {
    // A message that has been "sent" is always complete, even if its last word was skipped over.
    const prev = this.msgs[this.msgs.length - 1];
    if (prev) this.reveal(prev, Number.POSITIVE_INFINITY, false);
    const from = this.thread.offsetHeight;
    const msg = this.build(index);
    this.typing.remove();
    this.typingFor = -1;
    if (!this.msgs.length) this.thread.append(this.stamp());
    this.thread.append(msg.root);
    this.lockWidth(msg);
    this.msgs.push(msg);
    this.trim();
    this.reveal(msg, this.lines[index]!.startMs, false);
    this.placeStatus();
    if (reducedMotion()) return;
    this.slideThread(from);
    // A sticker that lands with the very first word follows the bubble in.
    if (msg.sticker?.shown) this.slap(msg.sticker.box, 220);
    const origin = msg.root.dataset.side === "me" ? "100% 100%" : "0 100%";
    msg.bubble.style.transformOrigin = origin;
    const f = this.fx();
    if (msg.loud) {
      this.slam(msg);
      if (msg.sticker?.shown) this.slap(msg.sticker.box, 420);
      return;
    }
    const turn = (msg.root.dataset.side === "me" ? 1 : -1) * 7 * f;
    msg.bubble.animate(
      [{ opacity: 0, transform: `scale(${(0.9 - 0.4 * f).toFixed(2)}) translateY(${Math.round(10 + 25 * f)}%) rotate(${turn.toFixed(1)}deg)` }, { opacity: 1, transform: `scale(${(1 + 0.04 * f).toFixed(3)})`, offset: 0.7 }, { opacity: 1, transform: "none" }],
      { duration: Math.round(300 + 220 * f), easing: "cubic-bezier(.2,.9,.3,1)" },
    );
  }

  /** After a seek: lay out the recent conversation at once, no animation. */
  private rebuild(index: number, positionMs: number): void {
    this.clear();
    this.typing.remove();
    this.typingFor = -1;
    if (index < 0) return;
    const indices: number[] = [];
    for (let i = index; i >= 0 && indices.length < KEEP; i--) if (this.plan[i]) indices.unshift(i);
    if (indices[0] === this.nextSlot(-1)) this.thread.append(this.stamp());
    for (const i of indices) {
      const msg = this.build(i);
      this.thread.append(msg.root);
      this.lockWidth(msg);
      this.msgs.push(msg);
      this.reveal(msg, i === index ? positionMs : Number.POSITIVE_INFINITY, false);
    }
    this.updateTapbacks(positionMs, false);
    this.placeStatus();
  }

  private trim(): void {
    while (this.msgs.length > KEEP) {
      const old = this.msgs.shift()!;
      const prev = old.root.previousElementSibling;
      if (prev?.classList.contains("bl-chat-stamp")) prev.remove();
      old.root.remove();
    }
  }

  private stamp(): HTMLElement {
    const node = el("div", "bl-chat-stamp");
    const now = new Date();
    const strong = el("b", "", node);
    strong.textContent = "Today";
    node.append(` ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    return node;
  }

  /** "Delivered" sits under the newest blue message once it has fully arrived. */
  private placeStatus(): void {
    const mine = [...this.msgs].reverse().find((m) => m.root.dataset.side === "me");
    if (!mine || mine.shown < mine.words.length) {
      this.status.remove();
      return;
    }
    if (this.status.parentElement !== mine.root) {
      mine.root.append(this.status);
      if (!reducedMotion()) this.status.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 250, fill: "backwards" });
    }
  }

  // ---- Typing dots ----

  private updateTyping(index: number, positionMs: number): void {
    const next = this.nextSlot(index);
    let show = -1;
    if (next >= 0) {
      const nextLine = this.lines[next]!;
      const prevEnd = index >= 0 ? this.lines[index]!.endMs : 0;
      const gap = nextLine.startMs - prevEnd;
      if (gap >= TYPING_MIN_GAP_MS && positionMs >= Math.max(prevEnd + 350, nextLine.startMs - TYPING_LEAD_MS) && positionMs < nextLine.startMs) show = next;
    }
    if (show === this.typingFor) return;
    const from = this.thread.offsetHeight;
    this.typingFor = show;
    if (show < 0) {
      this.typing.remove();
    } else {
      this.typing.dataset.side = this.plan[show]!.side ? "me" : "them";
      this.thread.append(this.typing);
      if (!reducedMotion()) this.typing.firstElementChild!.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.16,1,.3,1)" });
    }
    this.slideThread(from);
  }

  destroy(): void {
    this.wrap.remove();
  }
}

import { findStarted, flatten, type FlatWord, type SyncedLyrics } from "../lyrics/model";
import { el, hash, reducedMotion, rng, type Renderer } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_GROUP_WORDS = 16;
const MIN_GROUP_WORDS = 7;
const MIN_GROUP_MS = 3500;
const GROUP_BREAK_GAP_MS = 2500;
const PRE_MS = 420;
/** New phrases take over just before their first word, never cutting the last one short. */
const SWITCH_LEAD_MS = 120;
const DIM_AFTER_MS = 2600;
const GHOST_MS = 1100;
/** A four-point star with concave sides, the classic sparkle. Constant markup only. */
const SPARKLE = `<path d="M0-12C.7-4.6 4.6-.7 12 0 4.6.7.7 4.6 0 12-.7 4.6-4.6.7-12 0-4.6-.7-.7-4.6 0-12Z"/>`;

export interface StarGroup {
  words: FlatWord[];
  startMs: number;
}

/** Splits words into phrase groups, preferring line boundaries and instrumental gaps. */
export function buildGroups(words: FlatWord[]): StarGroup[] {
  const groups: StarGroup[] = [];
  let current: FlatWord[] = [];
  const flush = () => {
    if (current.length > 0) groups.push({ words: current, startMs: current[0]!.startMs });
    current = [];
  };
  // Work line by line so a constellation never splits a lyric line unless it is huge.
  const lines: FlatWord[][] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && last[0]!.lineIndex === w.lineIndex) last.push(w);
    else lines.push([w]);
  }
  for (const line of lines) {
    const prev = current[current.length - 1];
    const gap = !!prev && line[0]!.startMs - prev.endMs > GROUP_BREAK_GAP_MS;
    const tooBig = current.length > 0 && current.length + line.length > MAX_GROUP_WORDS;
    // A phrase stays up until it has a decent shape and has been on screen long enough to read.
    const settled = current.length >= MIN_GROUP_WORDS && line[0]!.startMs - current[0]!.startMs >= MIN_GROUP_MS;
    if (gap || tooBig || settled) flush();
    for (const w of line) {
      if (current.length >= MAX_GROUP_WORDS) flush();
      current.push(w);
    }
  }
  flush();
  return groups;
}

export interface Point {
  x: number;
  y: number;
}

export interface ConstellationPlan {
  /** Star positions as fractions of the stage. */
  points: Point[];
  /** For each word, the star it lights. Repeated words return to the same star. */
  starOf: number[];
}

/** Constellations live in a wide band across the middle, like the reference. */
const BAND = { x0: 0.1, x1: 0.9, y0: 0.26, y1: 0.7 };
const MIN_GAP = 0.1;
const CENTER = { x: 0.5, y: 0.48 };

export const starKey = (word: string): string => word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * Lays out a phrase as a constellation. Each new star is picked from random candidates across a
 * wide band, preferring medium-to-long jumps that change direction, keeping clear of other stars
 * and allowing the odd crossing line. That gives the irregular, back-and-forth shapes of real
 * asterisms without drifting into a straight line. Repeated words revisit their star, closing
 * loops. The finished shape is centred so nothing leaves the screen. Deterministic per seed.
 * `aspect` is width / height so spacing looks even on wide screens.
 */
export function planConstellation(words: string[], seed: number, aspect = 16 / 9): ConstellationPlan {
  const random = rng(seed);
  const w = (p: Point) => ({ x: p.x * aspect, y: p.y });
  const dist = (a: Point, b: Point) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const points: Point[] = [];
  const starOf: number[] = [];
  const byKey = new Map<string, number>();
  const segments: Array<[number, number]> = [];
  const span = { x: BAND.x1 - BAND.x0, y: BAND.y1 - BAND.y0 };

  words.forEach((word, i) => {
    const key = starKey(word);
    const seen = key ? byKey.get(key) : undefined;
    const prevStar = starOf[i - 1];
    if (seen !== undefined && seen !== prevStar) {
      if (prevStar !== undefined) segments.push([prevStar, seen]);
      starOf.push(seen);
      return;
    }
    if (prevStar === undefined) {
      points.push({ x: BAND.x0 + span.x * (0.2 + random() * 0.6), y: BAND.y0 + span.y * (0.2 + random() * 0.6) });
    } else {
      const from = points[prevStar]!;
      const before = starOf[i - 2] !== undefined ? points[starOf[i - 2]!] : undefined;
      let best: { p: Point; score: number } | null = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const p = { x: BAND.x0 + random() * span.x, y: BAND.y0 + random() * span.y };
        const d = dist(from, p);
        let score = d < 0.2 ? (0.2 - d) * 14 : d > 0.62 ? (d - 0.62) * 5 : 0;
        for (const q of points) {
          // Labels are wide and short: stars need room sideways unless they sit on different rows.
          const dx = Math.abs(q.x - p.x) * aspect;
          const dy = Math.abs(q.y - p.y);
          const crowd = Math.min(Math.max(0, 0.2 - dx) / 0.2, Math.max(0, 0.09 - dy) / 0.09);
          if (crowd > 0) score += crowd * 6;
          const g = dist(q, p);
          if (g < MIN_GAP) score += (MIN_GAP - g) * 50;
        }
        for (const [a, b] of segments) {
          if (a === prevStar || b === prevStar) continue;
          if (segmentsCross(w(from), w(p), w(points[a]!), w(points[b]!))) score += 0.5;
        }
        if (before) {
          // Avoid carrying on in the same direction, which reads as a line rather than a shape.
          const v1 = { x: (from.x - before.x) * aspect, y: from.y - before.y };
          const v2 = { x: (p.x - from.x) * aspect, y: p.y - from.y };
          const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
          if (cos > 0.75) score += (cos - 0.75) * 4;
        }
        score += random() * 0.35;
        if (!best || score < best.score) best = { p, score };
      }
      points.push(best!.p);
      segments.push([prevStar, points.length - 1]);
    }
    const index = points.length - 1;
    if (key) byKey.set(key, index);
    starOf.push(index);
  });

  // Centre the finished shape in the band.
  if (points.length > 0) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const dx = CENTER.x - (Math.min(...xs) + Math.max(...xs)) / 2;
    const dy = CENTER.y - (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const p of points) {
      p.x += dx;
      p.y += dy;
    }
  }
  return { points, starOf };
}

interface StarNode {
  node: HTMLElement;
  word: HTMLElement;
  hits: number;
}

interface Link {
  from: number;
  to: number;
  line: SVGLineElement;
  /** A wide soft stroke under the line, so links glow without a blur filter. */
  halo: SVGLineElement;
  wordIndex: number;
}

interface GroupView {
  root: HTMLElement;
  svg: SVGSVGElement;
  stars: StarNode[];
  links: Link[];
  plan: ConstellationPlan;
  born: number;
}

export class ConstellationRenderer implements Renderer {
  private readonly wrap: HTMLElement;
  private words: FlatWord[] = [];
  private groups: StarGroup[] = [];
  private groupIndex = -2;
  private view: GroupView | null = null;
  private activeWord = -2;
  private seedBase = 0;
  private width = 0;
  private height = 0;
  private readonly resize: ResizeObserver;

  constructor(root: HTMLElement) {
    this.wrap = el("div", "bl-stars", root);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.wrap);
  }

  setLyrics(lyrics: SyncedLyrics): void {
    this.words = flatten(lyrics.lines);
    this.groups = buildGroups(this.words);
    this.seedBase = hash(lyrics.lines.map((l) => l.text).join("|"));
    this.groupIndex = -2;
    this.activeWord = -2;
    this.dismiss(true);
  }

  private measure(): void {
    const w = this.wrap.clientWidth;
    const h = this.wrap.clientHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    if (this.view) this.layoutLinks(this.view);
  }

  update(positionMs: number): void {
    if (this.width === 0) this.measure();
    const groupIndex = findStarted(this.groups, positionMs + SWITCH_LEAD_MS);
    if (groupIndex !== this.groupIndex) this.showGroup(groupIndex);
    const view = this.view;
    if (!view || groupIndex < 0) return;
    const group = this.groups[groupIndex]!;
    const wordIndex = findStarted(group.words, positionMs);
    if (wordIndex !== this.activeWord) this.highlight(view, group, wordIndex);
    this.preview(view, group, wordIndex, positionMs);

    const last = group.words[group.words.length - 1]!;
    view.root.classList.toggle("bl-cgroup-dim", positionMs > last.endMs + DIM_AFTER_MS);
  }

  private dismiss(immediate: boolean): void {
    const old = this.view;
    this.view = null;
    if (!old) return;
    if (immediate || reducedMotion()) {
      old.root.remove();
      return;
    }
    old.root.classList.add("bl-cgroup-out");
    setTimeout(() => old.root.remove(), GHOST_MS);
  }

  private showGroup(index: number): void {
    this.groupIndex = index;
    this.activeWord = -2;
    this.dismiss(false);
    const group = this.groups[index];
    if (!group) return;
    const aspect = this.height > 0 ? this.width / this.height : 16 / 9;
    const plan = planConstellation(group.words.map((w) => w.text), this.seedBase + index * 7919, aspect);
    const root = el("div", "bl-cgroup", this.wrap);
    const svg = this.wrap.ownerDocument.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "bl-clinks");
    root.appendChild(svg);
    const random = rng(this.seedBase ^ (index * 2654435761));
    const stars = plan.points.map((p, i) => {
      const firstWord = group.words[plan.starOf.indexOf(i)]!;
      const node = el("div", "bl-star", root);
      node.style.left = `${p.x * 100}%`;
      node.style.top = `${p.y * 100}%`;
      // Magnitude: longer-held words become bigger stars, like brighter real ones.
      const held = Math.min(1, Math.max(0, (firstWord.endMs - firstWord.startMs - 150) / 900));
      node.style.setProperty("--m", (0.8 + held * 0.55 + random() * 0.2).toFixed(2));
      node.style.setProperty("--d", `${(random() * -4).toFixed(2)}s`);
      node.style.setProperty("--tw", `${(2.4 + random() * 2.6).toFixed(2)}s`);
      // Labels hug the side of the screen they are near and sit below stars in the top half,
      // so even the big current word never runs off the edge.
      node.dataset.align = p.x < 0.24 ? "start" : p.x > 0.76 ? "end" : "center";
      node.dataset.side = p.y < CENTER.y - 0.02 ? "below" : "above";
      el("i", "bl-star-halo", node);
      const glyph = this.wrap.ownerDocument.createElementNS(SVG_NS, "svg");
      glyph.setAttribute("class", "bl-star-glyph");
      glyph.setAttribute("viewBox", "-12 -12 24 24");
      glyph.innerHTML = SPARKLE;
      node.appendChild(glyph);
      el("i", "bl-star-ring", node);
      const word = el("span", "bl-star-word", node);
      word.textContent = firstWord.text;
      return { node, word, hits: 0 };
    });
    const links: Link[] = [];
    const seen = new Set<string>();
    plan.starOf.forEach((to, wordIndex) => {
      const from = plan.starOf[wordIndex - 1];
      if (from === undefined || from === to) return;
      const key = from < to ? `${from}-${to}` : `${to}-${from}`;
      if (seen.has(key)) return;
      seen.add(key);
      const halo = this.wrap.ownerDocument.createElementNS(SVG_NS, "line");
      halo.setAttribute("pathLength", "1");
      halo.setAttribute("class", "bl-link-halo");
      const line = this.wrap.ownerDocument.createElementNS(SVG_NS, "line");
      line.setAttribute("pathLength", "1");
      svg.append(halo, line);
      links.push({ from, to, line, halo, wordIndex });
    });
    this.view = { root, svg, stars, links, plan, born: performance.now() };
    this.layoutLinks(this.view);
  }

  private layoutLinks(view: GroupView): void {
    const { width: w, height: h } = this;
    view.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    for (const link of view.links) {
      const a = view.plan.points[link.from]!;
      const b = view.plan.points[link.to]!;
      for (const el of [link.line, link.halo]) {
        el.setAttribute("x1", String(a.x * w));
        el.setAttribute("y1", String(a.y * h));
        el.setAttribute("x2", String(b.x * w));
        el.setAttribute("y2", String(b.y * h));
      }
    }
  }

  private highlight(view: GroupView, group: StarGroup, wordIndex: number): void {
    const previous = this.activeWord;
    this.activeWord = wordIndex;
    const nowStar = wordIndex >= 0 ? view.plan.starOf[wordIndex] : -1;
    // Count visits so far, so repeated words grow and stay brighter.
    view.stars.forEach((s) => (s.hits = 0));
    for (let i = 0; i <= wordIndex; i++) view.stars[view.plan.starOf[i]!]!.hits++;
    view.stars.forEach((star, i) => {
      const lit = star.hits > 0;
      star.node.classList.toggle("bl-on", lit);
      star.node.classList.toggle("bl-now", i === nowStar);
      star.node.classList.toggle("bl-repeat", star.hits > 1);
      if (lit) star.node.classList.remove("bl-pre");
    });
    if (nowStar !== undefined && nowStar >= 0) {
      const star = view.stars[nowStar]!;
      star.word.textContent = group.words[wordIndex]!.text;
      if (wordIndex !== previous) {
        // Restart the arrival flash.
        star.node.classList.remove("bl-arrive");
        void star.node.offsetWidth;
        star.node.classList.add("bl-arrive");
      }
    }
    for (const link of view.links) {
      const drawn = link.wordIndex <= wordIndex;
      link.line.classList.toggle("bl-drawn", drawn);
      link.halo.classList.toggle("bl-drawn", drawn);
      // The newest link burns brighter for a moment.
      link.line.classList.toggle("bl-fresh", link.wordIndex === wordIndex);
    }
  }

  /** The next new star glints faintly just before its word, like the reference. */
  private preview(view: GroupView, group: StarGroup, wordIndex: number, positionMs: number): void {
    const next = group.words[wordIndex + 1];
    if (!next) return;
    const star = view.stars[view.plan.starOf[wordIndex + 1]!]!;
    if (star.hits === 0) star.node.classList.toggle("bl-pre", positionMs >= next.startMs - PRE_MS);
  }

  destroy(): void {
    this.resize.disconnect();
    this.wrap.remove();
  }
}

import { findStarted, type Line, type SyncedLyrics } from "../lyrics/model";
import { el, hash, reducedMotion, rng, type Renderer } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
const LEAVE_MS = 420;
const BUTTERFLY_MIN_MS = 7000;
const BUTTERFLY_SPREAD_MS = 9000;

export interface Pt {
  x: number;
  y: number;
}

const f = (n: number) => n.toFixed(1);

/** A rose head: a wavy-edged blob. Lobes vary so no two roses match. */
export function rosePath(r: number, random: () => number): string {
  const lobes = 8 + Math.floor(random() * 3);
  const pts: Pt[] = [];
  const turn = random() * Math.PI * 2;
  for (let i = 0; i < lobes; i++) {
    const a = turn + (i / lobes) * Math.PI * 2;
    const rr = r * (0.84 + random() * 0.24);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.92 });
  }
  // Smooth closed curve through lobe tips, bulging outward between them.
  let d = "";
  for (let i = 0; i < lobes; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % lobes]!;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const len = Math.hypot(mid.x, mid.y) || 1;
    const bulge = { x: mid.x + (mid.x / len) * r * 0.2, y: mid.y + (mid.y / len) * r * 0.2 };
    if (i === 0) d += `M${f(p.x)} ${f(p.y)}`;
    d += `Q${f(bulge.x)} ${f(bulge.y)} ${f(q.x)} ${f(q.y)}`;
  }
  return d + "Z";
}

/** The swirl drawn on a rose: an open spiral plus a couple of petal arcs. */
export function swirlPath(r: number, random: () => number): string {
  const phase = random() * Math.PI * 2;
  const turns = 2.4 + random() * 0.8;
  let d = "";
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const rr = r * (0.06 + (i / steps) * 0.6);
    const x = Math.cos(t + phase) * rr;
    const y = Math.sin(t + phase) * rr * 0.86;
    d += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  for (let k = 0; k < 2; k++) {
    const a = phase + k * Math.PI + random();
    const rr = r * 0.72;
    d += `M${f(Math.cos(a) * rr)} ${f(Math.sin(a) * rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(Math.cos(a + 0.9) * rr)} ${f(Math.sin(a + 0.9) * rr)}`;
  }
  return d;
}

/** A pointed leaf of length `len`, pointing along +x from the origin. */
export function leafPath(len: number): string {
  const w = len * 0.36;
  return `M0 0Q${f(len * 0.45)} ${f(-w)} ${f(len)} 0Q${f(len * 0.45)} ${f(w)} 0 0Z`;
}

interface Vine {
  d: string;
  /** Approximate drawn length, used to grow the stroke. */
  length: number;
  leaves: Array<{ at: Pt; angle: number; len: number }>;
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** A curling stem from `start` heading `dir` radians, ending in a little tendril. */
export function vine(start: Pt, dir: number, length: number, random: () => number): Vine {
  const segs = 2 + Math.floor(random() * 2);
  let p0 = start;
  let heading = dir;
  let d = `M${f(p0.x)} ${f(p0.y)}`;
  const leaves: Vine["leaves"] = [];
  const step = length / segs;
  for (let s = 0; s < segs; s++) {
    const bend = (random() - 0.5) * 1.6;
    const h1 = heading + bend;
    const h2 = heading - bend * 0.6;
    const p3 = { x: p0.x + Math.cos(heading + bend * 0.3) * step, y: p0.y + Math.sin(heading + bend * 0.3) * step };
    const p1 = { x: p0.x + Math.cos(h1) * step * 0.45, y: p0.y + Math.sin(h1) * step * 0.45 };
    const p2 = { x: p3.x - Math.cos(h2) * step * 0.45, y: p3.y - Math.sin(h2) * step * 0.45 };
    d += `C${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(p3.x)} ${f(p3.y)}`;
    for (const t of [0.35, 0.75]) {
      if (random() < 0.92) {
        const at = cubic(p0, p1, p2, p3, t);
        const ahead = cubic(p0, p1, p2, p3, Math.min(1, t + 0.05));
        const along = Math.atan2(ahead.y - at.y, ahead.x - at.x);
        const side = random() < 0.5 ? -1 : 1;
        leaves.push({ at, angle: along + side * (0.6 + random() * 0.5), len: step * (0.36 + random() * 0.2) });
      }
    }
    p0 = p3;
    heading = heading + bend * 0.5;
  }
  // Tendril: a tight curl at the tip.
  const curl = random() < 0.5 ? 1 : -1;
  const r = step * 0.14;
  const c = { x: p0.x + Math.cos(heading + curl * Math.PI / 2) * r, y: p0.y + Math.sin(heading + curl * Math.PI / 2) * r };
  for (let i = 1; i <= 10; i++) {
    const a = heading - (curl * Math.PI) / 2 + curl * (i / 10) * Math.PI * 1.7;
    const rr = r * (1 - i / 14);
    d += `L${f(c.x + Math.cos(a) * rr)} ${f(c.y + Math.sin(a) * rr)}`;
  }
  return { d, leaves, length: length * 1.18 + r * 5.5 };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One growing thing, positioned relative to its word so it follows the word as text re-centres. */
interface Item {
  kind: "vine" | "leaf" | "rose";
  word: number;
  path: Path2D;
  swirl?: Path2D;
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  delay: number;
  dur: number;
  born: number;
  /** Per-item offset so idle motion never moves in lockstep. */
  phase: number;
}

interface GardenView {
  root: HTMLElement;
  text: HTMLElement;
  canvas: HTMLCanvasElement;
  words: HTMLElement[];
  letters: HTMLElement[][];
  caret: HTMLElement;
  grown: Set<number>;
  boxes: Box[];
  seed: number;
  items: Item[];
  offsets: Pt[];
  offsetsStale: boolean;
  colors: { rose: string; line: string; vine: string };
  lastDraw: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
/** Once grown, the garden keeps moving gently; redraw at half rate to keep it cheap. */
const IDLE_FRAME_MS = 32;
const GROW = { vine: 700, leaf: 520, rose: 600 };

/**
 * Garden: each lyric line is typed in a serif and a garden grows out of every word as it is sung.
 * Curling vines with leaves reach out from the letters, roses bloom over them, and the odd
 * butterfly drifts through. Roses take the album colour and vines its complement.
 */
export class GardenRenderer implements Renderer {
  private readonly wrap: HTMLElement;
  private readonly fly: SVGSVGElement;
  private lines: Line[] = [];
  private active = -2;
  private view: GardenView | null = null;
  private revealed = "";
  private nextButterfly = 0;

  constructor(root: HTMLElement) {
    this.wrap = el("div", "bl-garden", root);
    this.fly = root.ownerDocument.createElementNS(SVG_NS, "svg");
    this.fly.setAttribute("class", "bl-garden-fly");
    this.wrap.appendChild(this.fly);
  }

  setLyrics(lyrics: SyncedLyrics): void {
    this.lines = lyrics.lines;
    this.active = -2;
    this.leave(true);
  }

  update(positionMs: number): void {
    const index = findStarted(this.lines, positionMs);
    if (index !== this.active) this.show(index);
    const view = this.view;
    const line = this.lines[index];
    if (!view || !line) return;

    // Type letters through each word's duration and grow its garden when it starts.
    let key = "";
    line.words.forEach((word, w) => {
      const letters = view.letters[w]!;
      const span = Math.max(1, Math.min(word.endMs - word.startMs, 90 * letters.length));
      const p = positionMs < word.startMs ? 0 : Math.min(1, (positionMs - word.startMs) / span);
      const count = Math.ceil(letters.length * p);
      key += `${count},`;
      if (count > 0 && !view.grown.has(w)) {
        view.grown.add(w);
        this.grow(view, w);
      }
    });
    if (key !== this.revealed) {
      this.revealed = key;
      const counts = key.split(",").map(Number);
      let last: HTMLElement | null = null;
      view.letters.forEach((letters, w) => {
        const shown = counts[w] ?? 0;
        view.words[w]!.hidden = shown === 0;
        letters.forEach((letter, i) => {
          const on = i < shown;
          letter.hidden = !on;
          if (on) last = letter;
        });
      });
      if (last) (last as HTMLElement).after(view.caret);
      view.offsetsStale = true;
    }
    this.draw(view);
    this.maybeButterfly();
  }

  private leave(immediate: boolean): void {
    const old = this.view;
    this.view = null;
    if (!old) return;
    if (immediate || reducedMotion()) {
      old.root.remove();
      return;
    }
    old.root.classList.add("bl-garden-out");
    setTimeout(() => old.root.remove(), LEAVE_MS);
  }

  private show(index: number): void {
    this.active = index;
    this.revealed = "";
    this.leave(false);
    const line = this.lines[index];
    if (!line || line.words.length === 0) return;
    const doc = this.wrap.ownerDocument;
    const root = el("div", "bl-garden-line", this.wrap);
    const text = el("div", "bl-garden-text", root);
    const chars = [...line.text].length;
    // Fit: long lines shrink and may wrap to two rows, like the reference regrowing smaller.
    text.style.setProperty("--bl-chars", String(Math.max(6, chars)));
    const letters: HTMLElement[][] = [];
    const words: HTMLElement[] = [];
    line.words.forEach((word) => {
      const span = el("span", "bl-garden-word", text);
      words.push(span);
      letters.push([...word.text].map((c) => {
        const l = el("span", "bl-garden-letter", span);
        l.textContent = c;
        return l;
      }));
    });
    const caret = el("span", "bl-garden-caret", text);
    // Measure each word at full length once, so its garden fits the finished word.
    text.style.visibility = "hidden";
    const boxes = words.map((span) => {
      const r = span.getBoundingClientRect();
      return { x: 0, y: 0, w: Math.max(8, r.width), h: Math.max(8, r.height) };
    });
    text.style.visibility = "";
    words.forEach((span) => (span.hidden = true));
    letters.flat().forEach((l) => (l.hidden = true));
    const canvas = el("canvas", "bl-garden-canvas", root);
    const css = getComputedStyle(this.wrap);
    const colors = { rose: css.getPropertyValue("--bl-rose").trim() || "#e8141f", line: css.getPropertyValue("--bl-rose-line").trim() || "#ffd9c8", vine: css.getPropertyValue("--bl-vine").trim() || "#2f45ff" };
    this.view = { root, text, canvas, words, letters, caret, grown: new Set(), boxes, seed: hash(line.text) ^ index, items: [], offsets: [], offsetsStale: true, colors, lastDraw: 0 };
  }

  /** Plans the garden for one word: vines first, then leaves, then roses on top. */
  private grow(view: GardenView, w: number): void {
    const box = view.boxes[w];
    if (!box || box.w === 0) return;
    const random = rng(view.seed + w * 977);
    const born = performance.now();
    const h = box.h;
    // Words on a lower row grow downward so they never climb into the row above.
    const lowerRow = view.words[w]!.offsetTop > view.words[0]!.offsetTop + h * 0.5;
    const isFirst = w === 0;
    const isLast = w === view.letters.length - 1;

    const vines: Array<{ start: Pt; dir: number; len: number }> = [];
    // Stems climb out above and drip below the letters.
    const stems = 2 + Math.floor(random() * 2) + (box.w > h * 1.6 ? 1 : 0);
    for (let i = 0; i < stems; i++) {
      const x = box.w * (0.1 + random() * 0.8);
      const up = lowerRow ? random() < 0.15 : random() < 0.62;
      // Upper-row stems that hang down stay short so they do not tangle with the next row.
      const reach = up || lowerRow ? 0.5 + random() * 0.4 : 0.28 + random() * 0.18;
      vines.push({ start: { x, y: h * (up ? 0.3 : 0.8) }, dir: (up ? -Math.PI / 2 : Math.PI / 2) + (random() - 0.5) * 0.9, len: h * reach });
    }
    // The first and last words send a long runner sideways, like the reference.
    if (isFirst) vines.push({ start: { x: h * 0.05, y: h * 0.62 }, dir: Math.PI + (random() - 0.5) * 0.4, len: h * (0.9 + random() * 0.4) });
    if (isLast) vines.push({ start: { x: box.w - h * 0.05, y: h * 0.6 }, dir: (random() - 0.5) * 0.4, len: h * (0.8 + random() * 0.4) });

    const width = Math.max(1.8, h * 0.03);
    vines.forEach((spec, i) => {
      const v = vine(spec.start, spec.dir, spec.len, random);
      view.items.push({ kind: "vine", word: w, path: new Path2D(v.d), x: 0, y: 0, angle: 0, length: v.length, width, delay: i * 70, dur: GROW.vine, born, phase: random() * 6.28 });
      v.leaves.forEach((leaf, k) => {
        view.items.push({ kind: "leaf", word: w, path: new Path2D(leafPath(leaf.len)), x: leaf.at.x, y: leaf.at.y, angle: leaf.angle, length: 0, width: 0, delay: 140 + i * 50 + k * 45, dur: GROW.leaf, born, phase: random() * 6.28 });
      });
    });

    // Roses cluster along the top of the word with a few tucked below, overlapping the letters.
    const roses = Math.max(2, Math.min(7, Math.round(box.w / (h * 0.42)) + Math.floor(random() * 2)));
    for (let i = 0; i < roses; i++) {
      // A few big blooms, more small ones, like a real cluster.
      const big = random() < 0.35;
      const r = h * (big ? 0.24 + random() * 0.08 : 0.13 + random() * 0.08);
      const above = lowerRow ? random() < 0.12 : random() < 0.7;
      const cx = Math.min(box.w - r * 0.6, Math.max(r * 0.6, box.w * ((i + 0.5) / roses + (random() - 0.5) * 0.14)));
      const cy = above ? h * (0.02 + random() * 0.16) - r * 0.45 : h * (0.84 + random() * 0.18) + r * 0.2;
      view.items.push({ kind: "rose", word: w, path: new Path2D(rosePath(r, random)), swirl: new Path2D(swirlPath(r, random)), x: cx, y: cy, angle: (random() < 0.5 ? -1 : 1) * (0.08 + random() * 0.12), length: 0, width: Math.max(0.8, r * 0.07), delay: 90 + i * 60, dur: GROW.rose, born, phase: random() * 6.28 });
    }
  }

  /** Draws the garden on one canvas. Idle once everything has grown and the text is still. */
  private draw(view: GardenView): void {
    const now = performance.now();
    const growing = view.items.some((it) => now < it.born + it.delay + it.dur + 34);
    const still = reducedMotion();
    const swaying = !still && view.items.length > 0;
    if (!growing && !view.offsetsStale && (!swaying || now - view.lastDraw < IDLE_FRAME_MS)) return;
    const t = now / 1000;
    const rootRect = view.root.getBoundingClientRect();
    const dpr = Math.min(2, (view.root.ownerDocument.defaultView ?? window).devicePixelRatio || 1);
    const cw = Math.round(rootRect.width * dpr);
    const ch = Math.round(rootRect.height * dpr);
    if (view.canvas.width !== cw || view.canvas.height !== ch) {
      view.canvas.width = cw;
      view.canvas.height = ch;
    }
    if (view.offsetsStale) {
      view.offsets = view.words.map((span) => {
        const r = span.getBoundingClientRect();
        return { x: r.left - rootRect.left, y: r.top - rootRect.top };
      });
      view.offsetsStale = false;
    }
    const g = view.canvas.getContext("2d");
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    // Vines and leaves first, roses on top, like the reference.
    for (const pass of ["vine", "leaf", "rose"] as const) {
      for (const it of view.items) {
        if (it.kind !== pass || view.words[it.word]!.hidden) continue;
        const raw = still ? 1 : (now - it.born - it.delay) / it.dur;
        if (raw <= 0) continue;
        const p = easeOut(Math.min(1, raw));
        const o = view.offsets[it.word]!;
        g.setTransform(dpr, 0, 0, dpr, (o.x + it.x) * dpr, (o.y + it.y) * dpr);
        if (it.kind === "vine") {
          g.strokeStyle = view.colors.vine;
          g.lineWidth = it.width;
          g.lineCap = "round";
          g.lineJoin = "round";
          g.setLineDash([it.length, it.length]);
          g.lineDashOffset = it.length * (1 - Math.min(1, raw));
          g.stroke(it.path);
          g.setLineDash([]);
        } else if (it.kind === "leaf") {
          // Leaves flutter around their stem.
          g.rotate(it.angle + (swaying ? Math.sin(t * 1.7 + it.phase) * 0.14 : 0));
          g.scale(p, p);
          g.fillStyle = view.colors.vine;
          g.fill(it.path);
        } else {
          // Roses keep turning slowly and breathe, each at its own pace.
          const spin = swaying ? Math.sin(t * 0.7 + it.phase) * 0.22 + t * it.angle : 0;
          const breathe = swaying ? 1 + Math.sin(t * 1.25 + it.phase) * 0.045 : 1;
          g.translate(0, swaying ? Math.sin(t * 0.9 + it.phase) * 1.6 : 0);
          g.rotate((-50 * (1 - p) * Math.PI) / 180 + spin);
          g.scale(p * breathe, p * breathe);
          g.fillStyle = view.colors.rose;
          g.fill(it.path);
          if (it.swirl) {
            g.strokeStyle = view.colors.line;
            g.lineWidth = it.width;
            g.lineCap = "round";
            g.globalAlpha = 0.9;
            g.stroke(it.swirl);
            g.globalAlpha = 1;
          }
        }
      }
    }
    view.lastDraw = now;
  }

  /** A white butterfly drifts across now and then. */
  private maybeButterfly(): void {
    if (reducedMotion() || !this.view) return;
    const now = performance.now();
    if (this.nextButterfly === 0) this.nextButterfly = now + 3500;
    if (now < this.nextButterfly) return;
    this.nextButterfly = now + BUTTERFLY_MIN_MS + Math.random() * BUTTERFLY_SPREAD_MS;
    const doc = this.wrap.ownerDocument;
    const w = this.wrap.clientWidth;
    const h = this.wrap.clientHeight;
    this.fly.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const b = doc.createElementNS(SVG_NS, "g");
    b.setAttribute("class", "bl-butterfly");
    b.innerHTML = `<g class="bl-butterfly-l"><path d="M0 0C-7-9-15-8-14-2-13 3-6 3 0 0ZM0 1C-6 3-11 7-8 10-5 12-2 6 0 1Z"/></g><g class="bl-butterfly-r"><path d="M0 0C7-9 15-8 14-2 13 3 6 3 0 0ZM0 1C6 3 11 7 8 10 5 12 2 6 0 1Z"/></g>`;
    this.fly.appendChild(b);
    const fromLeft = Math.random() < 0.5;
    const y0 = h * (0.2 + Math.random() * 0.6);
    const pts = Array.from({ length: 6 }, (_, i) => {
      const t = i / 5;
      const x = fromLeft ? -30 + t * (w + 60) : w + 30 - t * (w + 60);
      return { transform: `translate(${f(x)}px, ${f(y0 + Math.sin(t * 7 + Math.random()) * h * 0.08)}px) rotate(${fromLeft ? 8 : -8}deg) scale(${(0.9 + Math.random() * 0.5).toFixed(2)})` };
    });
    const run = b.animate(pts, { duration: 7000 + Math.random() * 3000, easing: "linear" });
    run.onfinish = () => b.remove();
  }

  destroy(): void {
    this.wrap.remove();
  }
}

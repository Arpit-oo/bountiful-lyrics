import { findStarted, type Line, type SyncedLyrics } from "../lyrics/model";
import { el, hash, reducedMotion, type Renderer } from "./types";

export interface CodeLine {
  text: string;
  /** [start, end) character range of each word in `text`. */
  ranges: Array<[number, number]>;
}

const clean = (word: string): string =>
  word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/['’]/g, "") || "_";

/** Turns a lyric line into a code-like string while remembering where each word landed. */
export function formatCodeLine(words: string[], seed: number): CodeLine {
  const parts = words.map(clean);
  const variant = parts.length < 2 ? 0 : seed % 5;
  const build = (prefix: string, sep: (i: number) => string, suffix: string): CodeLine => {
    let text = prefix;
    const ranges: Array<[number, number]> = [];
    parts.forEach((part, i) => {
      if (i > 0) text += sep(i);
      ranges.push([text.length, text.length + part.length]);
      text += part;
    });
    return { text: text + suffix, ranges };
  };
  switch (variant) {
    case 1:
      return build("// ", () => " ", "");
    case 2:
      return build("", (i) => (i === 1 ? "(" : ", "), ")");
    case 3:
      return build("", () => "_", "");
    default:
      return build("", () => ".", "");
  }
}

const VISIBLE_ROWS = 4;

/** Writes code text with punctuation in its own span so it can be tinted like syntax. */
function paint(target: HTMLElement, text: string): void {
  target.replaceChildren();
  const doc = target.ownerDocument;
  for (const part of text.split(/([^\p{L}\p{N}_]+)/u)) {
    if (!part) continue;
    if (/^[^\p{L}\p{N}_]+$/u.test(part)) {
      const span = doc.createElement("span");
      span.className = "bl-code-punc";
      span.textContent = part;
      target.appendChild(span);
    } else {
      target.appendChild(doc.createTextNode(part));
    }
  }
}

export class CodestyleRenderer implements Renderer {
  private readonly wrap: HTMLElement;
  private readonly rows: HTMLElement[];
  private readonly typed: HTMLElement;
  private readonly cursor: HTMLElement;
  private lines: Line[] = [];
  private code: CodeLine[] = [];
  private activeLine = -2;
  private revealed = -1;

  constructor(root: HTMLElement) {
    this.wrap = el("div", "bl-code", root);
    this.rows = Array.from({ length: VISIBLE_ROWS }, () => el("div", "bl-code-row", this.wrap));
    const current = this.rows[VISIBLE_ROWS - 1]!;
    current.classList.add("bl-code-current");
    this.typed = el("span", "", current);
    this.cursor = el("span", "bl-cursor", current);
  }

  setLyrics(lyrics: SyncedLyrics): void {
    this.lines = lyrics.lines;
    this.code = lyrics.lines.map((l) => formatCodeLine(l.words.map((w) => w.text), hash(l.text)));
    this.activeLine = -2;
    this.revealed = -1;
  }

  update(positionMs: number): void {
    const index = findStarted(this.lines, positionMs);
    if (index !== this.activeLine) this.showLine(index);
    if (index < 0) return;
    const count = this.revealedChars(index, positionMs);
    if (count !== this.revealed) {
      this.revealed = count;
      paint(this.typed, this.code[index]!.text.slice(0, count));
      this.cursor.classList.toggle("bl-cursor-idle", count >= this.code[index]!.text.length);
    }
  }

  private revealedChars(index: number, positionMs: number): number {
    const line = this.lines[index]!;
    const code = this.code[index]!;
    const wordIndex = findStarted(line.words, positionMs);
    if (wordIndex < 0) return 0;
    const word = line.words[wordIndex]!;
    const [start, end] = code.ranges[wordIndex]!;
    const progress = Math.min(1, (positionMs - word.startMs) / Math.max(1, word.endMs - word.startMs));
    if (progress >= 1 && wordIndex === line.words.length - 1) return code.text.length;
    return start + Math.ceil((end - start) * progress);
  }

  private showLine(index: number): void {
    this.activeLine = index;
    this.revealed = -1;
    this.typed.textContent = "";
    for (let offset = 1; offset < VISIBLE_ROWS; offset++) {
      const row = this.rows[VISIBLE_ROWS - 1 - offset]!;
      paint(row, this.code[index - offset]?.text ?? "");
      row.dataset.age = String(offset);
      this.lean(row, index - offset);
    }
    this.lean(this.rows[VISIBLE_ROWS - 1]!, index);
    if (!reducedMotion() && index >= 0) {
      this.wrap.animate([{ transform: "translateY(0.9em)", opacity: 0.6 }, { transform: "translateY(0)", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }

  /** A small, stable lean per line so the stack feels hand-placed. Scaled by the Tilt setting. */
  private lean(row: HTMLElement, lineIndex: number): void {
    const seed = hash(`lean:${lineIndex}:${this.lines[lineIndex]?.text ?? ""}`);
    row.style.setProperty("--rz", String(((seed % 1000) / 1000 - 0.5) * 7));
    row.style.setProperty("--tx", String((((seed >>> 10) % 1000) / 1000 - 0.5) * 8));
  }

  destroy(): void {
    this.wrap.remove();
  }
}

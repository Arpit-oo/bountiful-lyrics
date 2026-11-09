import type { Line, RawLine, SyncedLyrics, Word } from "../lyrics/model";

const MS_PER_WEIGHT = 300;
const MAX_STRETCH = 1.7;
const LEAD_OUT = 0.06;
const DEFAULT_LAST_LINE_MS = 5000;
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    if (CJK.test(token) && [...token].length > 1) out.push(...token);
    else out.push(token);
  }
  return out;
}

/** Rough sung-length weight. Falls back to length for scripts without Latin vowels. */
export function wordWeight(word: string): number {
  const lower = word.toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");
  if (!lower) return 0.5;
  let weight: number;
  if (/^[a-z'’]+$/.test(lower)) {
    const groups = lower.replace(/e$/, "").match(/[aeiouy]+/g);
    weight = Math.max(1, groups?.length ?? 1);
  } else if (CJK.test(lower)) {
    weight = 1;
  } else {
    weight = Math.max(1, [...lower].length / 2.5);
  }
  if (/[,;:]$/.test(word)) weight += 0.5;
  if (/[.!?…]$/.test(word)) weight += 0.8;
  return weight;
}

/** Splits a line's time across its words, ending early when the line holds through a gap. */
export function estimateWords(text: string, startMs: number, endMs: number): Word[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];
  const span = Math.max(1, endMs - startMs);
  const weights = tokens.map(wordWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  const voiced = Math.min(span * (1 - LEAD_OUT), total * MS_PER_WEIGHT * MAX_STRETCH);
  let cursor = startMs;
  return tokens.map((token, i) => {
    const wordEnd = i === tokens.length - 1 ? startMs + voiced : cursor + (weights[i]! / total) * voiced;
    const word: Word = { text: token, startMs: Math.round(cursor), endMs: Math.round(wordEnd) };
    cursor = wordEnd;
    return word;
  });
}

function realWords(raw: RawLine, endMs: number): Word[] {
  const src = raw.words ?? [];
  return src.map((w, i) => {
    const next = src[i + 1]?.startMs ?? endMs;
    return {
      text: w.text,
      startMs: w.startMs,
      endMs: Math.max(w.startMs + 1, Math.min(w.endMs ?? next, next)),
    };
  });
}

/** Normalizes raw timed lines. Empty lines bound the previous line and are then dropped. */
export function buildSyncedLyrics(raw: RawLine[], source: string, durationMs: number): SyncedLyrics {
  const sorted = raw
    .filter((l) => Number.isFinite(l.startMs) && l.startMs >= 0)
    .sort((a, b) => a.startMs - b.startMs);
  const lines: Line[] = [];
  sorted.forEach((current, i) => {
    if (!current.text.trim()) return;
    const nextStart = sorted[i + 1]?.startMs;
    const fallbackEnd = durationMs > current.startMs ? Math.min(durationMs, current.startMs + DEFAULT_LAST_LINE_MS) : current.startMs + DEFAULT_LAST_LINE_MS;
    const declaredEnd = current.endMs && current.endMs > current.startMs ? current.endMs : undefined;
    const bound = nextStart !== undefined && nextStart > current.startMs ? nextStart : fallbackEnd;
    const endMs = declaredEnd !== undefined ? Math.min(declaredEnd, bound) : bound;
    const hasWords = !!current.words?.length;
    lines.push({
      text: current.text.trim(),
      startMs: current.startMs,
      endMs,
      words: hasWords ? realWords(current, endMs) : estimateWords(current.text, current.startMs, endMs),
      timing: hasWords ? "word" : "estimated",
    });
  });
  return { kind: "synced", source, lines };
}

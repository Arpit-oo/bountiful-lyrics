import type { Line } from "../lyrics/model";

/**
 * One slice of Spotify's audio analysis. `loudness` is the slice's peak level in dB (negative,
 * closer to 0 is louder); `bright` is the second timbre value, which rises with harsh, bright
 * sounds such as screaming or distorted guitars.
 */
export interface LoudSegment {
  startMs: number;
  endMs: number;
  loudness: number;
  bright: number;
}

/** A song whose lines barely change in level has nothing that stands out as a shout. */
const MIN_SPREAD_DB = 0.8;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Robust spread: median absolute deviation scaled to match a standard deviation. */
const spread = (xs: number[], mid: number): number => median(xs.map((x) => Math.abs(x - mid))) * 1.4826;

export interface LoudScores {
  /** How far each line stands out from the song's typical level; NaN when unknown. */
  score: number[];
  /** Each line's place in the loudness ranking, 0 = loudest, 1 = quietest; NaN when unknown. */
  rank: number[];
}

/**
 * Scores each line by how much louder and harsher it is than the rest of the song. A line's level
 * is the mean of its three loudest slices, so one drum hit doesn't count but a held scream does.
 */
export function scoreLoudness(lines: Array<Pick<Line, "text" | "startMs" | "endMs">>, segments: LoudSegment[]): LoudScores {
  const n = lines.length;
  const level: number[] = new Array(n).fill(Number.NaN);
  const bright: number[] = new Array(n).fill(Number.NaN);
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  let from = 0;
  lines.forEach((line, i) => {
    if (!line.text.trim() || line.endMs <= line.startMs) return;
    while (from < sorted.length && sorted[from]!.endMs <= line.startMs) from++;
    const inside: LoudSegment[] = [];
    for (let k = from; k < sorted.length && sorted[k]!.startMs < line.endMs; k++) inside.push(sorted[k]!);
    if (!inside.length) return;
    const top = [...inside].sort((a, b) => b.loudness - a.loudness).slice(0, 3);
    level[i] = top.reduce((sum, s) => sum + s.loudness, 0) / top.length;
    bright[i] = inside.reduce((sum, s) => sum + s.bright, 0) / inside.length;
  });

  const known = level.map((v, i) => (Number.isFinite(v) ? i : -1)).filter((i) => i >= 0);
  const score: number[] = new Array(n).fill(Number.NaN);
  const rank: number[] = new Array(n).fill(Number.NaN);
  if (known.length < 4) return { score, rank };
  const levels = known.map((i) => level[i]!);
  const brights = known.map((i) => bright[i]!);
  const midL = median(levels);
  const rawL = spread(levels, midL);
  if (rawL < MIN_SPREAD_DB) return { score, rank };
  const sL = Math.max(1, rawL);
  const midB = median(brights);
  const sB = Math.max(1, spread(brights, midB));
  let prev = Number.NaN;
  for (const i of known) {
    let z = (level[i]! - midL) / sL + 0.35 * ((bright[i]! - midB) / sB);
    // A sudden jump up from the line before is what makes a scream hit.
    if (Number.isFinite(prev) && level[i]! - prev >= 3) z += 0.3;
    score[i] = z;
    prev = level[i]!;
  }
  const order = [...known].sort((a, b) => score[b]! - score[a]!);
  order.forEach((i, k) => (rank[i] = order.length > 1 ? k / (order.length - 1) : 0));
  return { score, rank };
}

/**
 * Whether a line counts as shouted at a given strength (0 = never, 1 = generous).
 * Higher strength lowers the bar and lets a bigger share of the song through.
 */
export function isShouted(scores: LoudScores, index: number, strength: number): boolean {
  if (strength <= 0) return false;
  const z = scores.score[index];
  const r = scores.rank[index];
  if (z === undefined || r === undefined || !Number.isFinite(z) || !Number.isFinite(r)) return false;
  const minZ = 2 - 1.1 * strength;
  const share = 0.03 + 0.15 * strength;
  return z >= minZ && r <= share;
}

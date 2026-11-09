export interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

export type LineTiming = "word" | "estimated";

export interface Line {
  text: string;
  startMs: number;
  endMs: number;
  words: Word[];
  timing: LineTiming;
}

export interface SyncedLyrics {
  kind: "synced";
  source: string;
  lines: Line[];
}

export interface UnsyncedLyrics {
  kind: "unsynced";
  source: string;
  text: string[];
}

export type Lyrics = SyncedLyrics | UnsyncedLyrics;

/** A timed line before normalization. `wordStarts` is set only with real word timing. */
export interface RawLine {
  startMs: number;
  text: string;
  endMs?: number;
  words?: Array<{ text: string; startMs: number; endMs?: number }>;
}

export interface FlatWord extends Word {
  lineIndex: number;
  wordIndex: number;
}

export function flatten(lines: Line[]): FlatWord[] {
  const out: FlatWord[] = [];
  lines.forEach((line, lineIndex) => {
    line.words.forEach((word, wordIndex) => out.push({ ...word, lineIndex, wordIndex }));
  });
  return out;
}

/** Index of the last item whose start is at or before `positionMs`, or -1. */
export function findStarted<T extends { startMs: number }>(items: T[], positionMs: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid]!.startMs <= positionMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

import type { RawLine } from "./model";

const LINE_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

function toMs(min: string, sec: string, frac: string | undefined): number {
  const f = frac ? Number(frac.padEnd(3, "0").slice(0, 3)) : 0;
  return Number(min) * 60_000 + Number(sec) * 1000 + f;
}

function parseWords(body: string): RawLine["words"] | undefined {
  const tags = [...body.matchAll(WORD_TAG)];
  if (tags.length === 0) return undefined;
  const words: NonNullable<RawLine["words"]> = [];
  tags.forEach((tag, i) => {
    const textStart = tag.index + tag[0].length;
    const textEnd = tags[i + 1]?.index ?? body.length;
    const text = body.slice(textStart, textEnd).trim();
    const startMs = toMs(tag[1]!, tag[2]!, tag[3]);
    if (text) {
      words.push({ text, startMs });
    } else if (words.length > 0) {
      // A trailing tag with no text marks the end of the previous word.
      words[words.length - 1]!.endMs = startMs;
    }
  });
  return words.length > 0 ? words : undefined;
}

/**
 * Parses LRC and enhanced LRC. Lines with empty text are kept: they mark
 * instrumental gaps and bound the previous line's end time.
 */
export function parseLrc(input: string): RawLine[] {
  const out: RawLine[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const tags = [...rawLine.matchAll(LINE_TAG)];
    if (tags.length === 0) continue;
    const last = tags[tags.length - 1]!;
    const body = rawLine.slice(last.index + last[0].length);
    const words = parseWords(body);
    const text = words ? words.map((w) => w.text).join(" ") : body.trim();
    for (const tag of tags) {
      const line: RawLine = { startMs: toMs(tag[1]!, tag[2]!, tag[3]), text };
      if (words) line.words = words;
      out.push(line);
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

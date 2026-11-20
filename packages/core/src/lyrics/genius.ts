// Who sings which line, from Genius section headers such as "[Verse 1: Mike Shinoda]".
// Search goes through Genius's official API (needs the user's own free token); the lyrics come from
// the public embed script. Both answer cross-origin requests, so no proxy is involved.

import type { Line } from "./model";

export interface GeniusSection {
  /** Singers named in the header, or null when the header names nobody (the main artist). */
  singers: string[] | null;
  lines: string[];
}

const TIMEOUT_MS = 7000;

// ---------- Parsing ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Reads a JavaScript single-quoted string literal body without evaluating anything. */
function unescapeJsString(body: string): string {
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, e: string) => {
    if (e[0] === "u" && e.length === 5) return String.fromCharCode(Number.parseInt(e.slice(1), 16));
    if (e[0] === "x" && e.length === 3) return String.fromCharCode(Number.parseInt(e.slice(1), 16));
    return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" } as Record<string, string>)[e] ?? e;
  });
}

/** Splits a header's credit like "Mike Shinoda, Mike Shinoda & Chester Bennington" into unique names. */
export function parseSingers(credit: string): string[] {
  const names = credit
    .replace(/\(.*?\)/g, "")
    .split(/\s*(?:,|&|\+|\/|\band\b|\bwith\b|\bfeat\.?|\bft\.?)\s*/i)
    .map((n) => n.replace(/\*/g, "").trim())
    .filter(Boolean);
  return [...new Set(names)];
}

/** Turns lyrics text with "[Section: Singer]" headers into sections. */
export function parseSections(text: string): GeniusSection[] {
  const out: GeniusSection[] = [];
  let current: GeniusSection = { singers: null, lines: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      if (current.lines.length) out.push(current);
      const colon = header[1]!.indexOf(":");
      const singers = colon >= 0 ? parseSingers(header[1]!.slice(colon + 1)) : [];
      current = { singers: singers.length ? singers : null, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length) out.push(current);
  return out;
}

/** Pulls the lyrics out of a Genius embed.js file. */
export function parseEmbed(js: string): GeniusSection[] {
  const m = /JSON\.parse\('((?:[^'\\]|\\[\s\S])*)'\)/.exec(js.slice(js.indexOf("rg_embed")));
  if (!m) return [];
  let markup: string;
  try {
    markup = JSON.parse(unescapeJsString(m[1]!)) as string;
  } catch {
    return [];
  }
  // Only the lyrics body: skip the "Powered by Genius" header and the title/artist footer.
  const start = markup.indexOf("rg_embed_body");
  const footer = markup.indexOf("rg_embed_footer");
  if (start < 0) return [];
  const end = footer > start ? markup.lastIndexOf("<", footer) : -1;
  const body = markup.slice(markup.indexOf(">", start) + 1, end > start ? end : undefined);
  const text = decodeEntities(body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div)>/gi, "\n").replace(/<[^>]+>/g, ""));
  return parseSections(text);
}

// ---------- Matching ----------

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/** Share of words two lines have in common, 0 to 1. */
function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const pool = new Map<string, number>();
  for (const w of b) pool.set(w, (pool.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of a) {
    const n = pool.get(w) ?? 0;
    if (n > 0) {
      common++;
      pool.set(w, n - 1);
    }
  }
  return (2 * common) / (a.length + b.length);
}

const LOOKAHEAD = 14;
const MIN_SIMILARITY = 0.6;

/**
 * Lines up the timed lyrics with the Genius text and returns who sings each timed line.
 * Walks both in order, so a repeated chorus picks up the singer of the chorus it belongs to.
 * Lines that can't be matched take the singer of the line before.
 */
export function assignSingers(lines: Array<Pick<Line, "text">>, sections: GeniusSection[], mainArtist: string): Array<string[] | null> {
  const flat: Array<{ words: string[]; singers: string[] }> = [];
  for (const s of sections) for (const l of s.lines) flat.push({ words: words(l), singers: s.singers ?? [mainArtist] });
  const out: Array<string[] | null> = [];
  let j = 0;
  let prev: string[] | null = null;
  for (const line of lines) {
    const w = words(line.text);
    if (!w.length) {
      out.push(null);
      continue;
    }
    let best = -1;
    let bestScore = MIN_SIMILARITY;
    for (let k = j; k < Math.min(flat.length, j + LOOKAHEAD); k++) {
      const score = similarity(w, flat[k]!.words) - (k - j) * 0.004;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (best >= 0) {
      prev = flat[best]!.singers;
      j = best + 1;
    }
    out.push(prev);
  }
  return out;
}

/**
 * Decides which side each line goes on. The two voices with the most lines get a side each; a line
 * they sing together goes to whoever is named first. Returns null when the song really has one voice.
 */
export function singerSides(singers: Array<string[] | null>): { side: Array<0 | 1 | null>; name: Array<string | null> } | null {
  const count = new Map<string, number>();
  for (const s of singers) if (s) for (const n of s) count.set(n, (count.get(n) ?? 0) + 1);
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length < 2 || ranked[1]![1] < 3) return null;
  // Whoever sings first opens on the left, like the other person texting first.
  const top = new Set([ranked[0]![0], ranked[1]![0]]);
  const first = singers.find((s) => s?.some((n) => top.has(n)))?.find((n) => top.has(n)) ?? ranked[0]![0];
  const second = [...top].find((n) => n !== first)!;
  const side: Array<0 | 1 | null> = [];
  const name: Array<string | null> = [];
  let last: 0 | 1 = 0;
  for (const s of singers) {
    if (!s) {
      side.push(null);
      name.push(null);
      continue;
    }
    const lead = s.find((n) => top.has(n));
    last = lead === second ? 1 : lead === first ? 0 : last;
    side.push(last);
    name.push(s.join(" & "));
  }
  return { side, name };
}

// ---------- Fetching ----------

const clean = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\b(feat|ft)\.?\s.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

async function getJson(url: string, token: string): Promise<any> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    // Token in the query, not a header: a header forces a CORS preflight, which Genius rejects.
    const res = await fetch(`${url}&access_token=${encodeURIComponent(token)}`, { signal: abort.signal });
    return res.ok ? res.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Finds the song on Genius and returns its sections, or null if it can't be found. */
export async function fetchGeniusSections(title: string, artist: string, token: string): Promise<GeniusSection[] | null> {
  const want = { title: clean(title), artist: clean(artist) };
  try {
    const search = await getJson(`https://api.genius.com/search?q=${encodeURIComponent(`${want.title} ${want.artist}`)}`, token);
    const hits: any[] = search?.response?.hits ?? [];
    const hit = hits
      .map((h) => h?.result)
      .find((r) => r && clean(String(r.title ?? "")) === want.title && clean(String(r.primary_artist?.name ?? "")).includes(want.artist.split(" ")[0] ?? ""));
    if (!hit?.id) return null;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`https://genius.com/songs/${Number(hit.id)}/embed.js`, { signal: abort.signal });
      if (!res.ok) return null;
      const sections = parseEmbed(await res.text());
      return sections.length ? sections : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

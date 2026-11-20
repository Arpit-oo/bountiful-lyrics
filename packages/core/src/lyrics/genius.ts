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

/*
 * Sound skeletons let a romanized Genius line ("Tere nakhre jawani") match the same line written in
 * an Indic script ("ਤੇਰੇ ਨਖ਼ਰੇ ਜਵਾਨੀ"). Both sides keep only rough consonant sounds, since vowels and
 * spellings vary wildly between romanizations.
 *
 * The Indic scripts in Unicode share one layout (inherited from ISCII), so one table covers
 * Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam.
 * Index = code point offset within the script block, starting at 0x15 (the "ka" letter).
 */
const INDIC_TABLE = ["k", "k", "g", "g", "n", "c", "c", "j", "j", "n", "t", "t", "d", "d", "n", "t", "t", "d", "d", "n", "n", "p", "f", "b", "b", "m", "", "r", "r", "l", "l", "l", "v", "s", "s", "s", ""];
/** Precomposed nukta letters: qa, khha, ghha, za, dddha (flap), rha, fa, yya. */
const NUKTA: Record<number, string> = { 0x58: "k", 0x59: "k", 0x5a: "g", 0x5b: "j", 0x5c: "r", 0x5d: "r", 0x5e: "f", 0x5f: "" };

function indicSound(code: number): string | null {
  if (code < 0x0900 || code > 0x0d7f) return null;
  const offset = (code - 0x0900) % 0x80;
  if (offset >= 0x15 && offset <= 0x39) return INDIC_TABLE[offset - 0x15]!;
  if (NUKTA[offset] !== undefined) return NUKTA[offset]!;
  return ""; // vowels, vowel signs, nasal marks, virama, digits: dropped
}

/** Rough consonant sounds of a line, in any of the supported scripts. */
export function skeleton(text: string): string {
  let latin = "";
  for (const ch of text.toLowerCase()) {
    const sound = indicSound(ch.codePointAt(0)!);
    latin += sound === null ? ch : sound;
  }
  return latin
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/[cs]h/g, (m) => m[0]!)
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/[^bcdfgjklmnprstv]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** Dice similarity of two skeletons over letter pairs, 0 to 1. */
function soundSimilarity(a: string, b: string): number {
  if (a.length < 4 || b.length < 4) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < b.length - 1; i++) {
    const p = b.slice(i, i + 2);
    pairs.set(p, (pairs.get(p) ?? 0) + 1);
  }
  let common = 0;
  for (let i = 0; i < a.length - 1; i++) {
    const p = a.slice(i, i + 2);
    const n = pairs.get(p) ?? 0;
    if (n > 0) {
      common++;
      pairs.set(p, n - 1);
    }
  }
  return (2 * common) / (a.length - 1 + b.length - 1);
}

const LOOKAHEAD = 14;
const MIN_SIMILARITY = 0.6;
const MIN_SOUND_SIMILARITY = 0.55;
/** Below this share of matched lines, text matching has failed (a script we can't read). */
const MIN_MATCHED = 0.35;

type Flat = { words: string[]; sound: string; singers: string[] };

function matchByText(lines: Array<Pick<Line, "text">>, flat: Flat[]): { singers: Array<string[] | null>; matched: number } {
  const out: Array<string[] | null> = [];
  let j = 0;
  let prev: string[] | null = null;
  let matched = 0;
  for (const line of lines) {
    const w = words(line.text);
    if (!w.length) {
      out.push(null);
      continue;
    }
    const sound = skeleton(line.text);
    let best = -1;
    let bestScore = 0;
    for (let k = j; k < Math.min(flat.length, j + LOOKAHEAD); k++) {
      const byWords = similarity(w, flat[k]!.words);
      const bySound = soundSimilarity(sound, flat[k]!.sound);
      // Normalise both onto the same pass mark, then keep whichever reads better.
      const score = Math.max(byWords / MIN_SIMILARITY, bySound / MIN_SOUND_SIMILARITY) - (k - j) * 0.006;
      if (score >= 1 && score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (best >= 0) {
      prev = flat[best]!.singers;
      j = best + 1;
      matched++;
    }
    out.push(prev);
  }
  return { singers: out, matched };
}

/**
 * Last resort for scripts we can't compare at all: if both versions have about the same number of
 * lines, line i of the song is taken to be line i on Genius, scaled to fit.
 */
function matchByPosition(lines: Array<Pick<Line, "text">>, flat: Flat[]): Array<string[] | null> | null {
  const sung = lines.map((l, i) => (words(l.text).length ? i : -1)).filter((i) => i >= 0);
  if (!sung.length || !flat.length) return null;
  const ratio = flat.length / sung.length;
  if (ratio < 0.75 || ratio > 1.33) return null;
  const out: Array<string[] | null> = lines.map(() => null);
  sung.forEach((index, k) => {
    out[index] = flat[Math.min(flat.length - 1, Math.floor(k * ratio))]!.singers;
  });
  return out;
}

/**
 * Lines up the timed lyrics with the Genius text and returns who sings each timed line.
 * Walks both in order, so a repeated chorus picks up the singer of the chorus it belongs to.
 * Lines that can't be matched take the singer of the line before. Matches on words, on sound
 * (so romanized Genius lyrics fit lyrics in Gurmukhi, Devanagari and other Indic scripts), and
 * falls back to line position when neither works.
 */
export function assignSingers(lines: Array<Pick<Line, "text">>, sections: GeniusSection[], mainArtist: string): Array<string[] | null> {
  // "[Chorus: Both]" means the song's main voices together, not a singer called Both.
  const group = (n: string) => /^(both|all|together|everyone|everybody|all three|tutti)$/i.test(n);
  const count = new Map<string, number>();
  for (const s of sections) for (const n of s.singers ?? []) if (!group(n)) count.set(n, (count.get(n) ?? 0) + s.lines.length);
  const main = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
  const who = (singers: string[] | null): string[] => {
    if (!singers) return [mainArtist];
    const named = singers.flatMap((n) => (group(n) ? main : [n]));
    return named.length ? [...new Set(named)] : [mainArtist];
  };
  const flat: Flat[] = [];
  for (const s of sections) for (const l of s.lines) flat.push({ words: words(l), sound: skeleton(l), singers: who(s.singers) });
  const byText = matchByText(lines, flat);
  const sung = lines.filter((l) => words(l.text).length).length;
  if (sung && byText.matched / sung >= MIN_MATCHED) return byText.singers;
  return matchByPosition(lines, flat) ?? byText.singers;
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

/** How alike two names are, 0 to 1: same words, or the same sound in another spelling or script. */
function nameMatch(a: string, b: string): number {
  const ca = clean(a);
  const cb = clean(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) return 0.9;
  return Math.max(similarity(words(ca), words(cb)), soundSimilarity(skeleton(ca), skeleton(cb)));
}

export interface GeniusHit {
  id: number;
  title: string;
  primary_artist?: { name?: string };
  artist_names?: string;
}

/** Translation and romanization pages carry the same headers, but the original comes first. */
const HELPER_ARTIST = /^genius\b/i;

/**
 * Picks the search result for this song. The title has to match (allowing for different spellings,
 * scripts and "(feat. ...)" extras) and the Spotify artist has to be among the credited artists.
 */
export function pickHit(hits: GeniusHit[], title: string, artist: string): GeniusHit | null {
  let best: GeniusHit | null = null;
  let bestScore = 0;
  for (const hit of hits) {
    if (!hit?.id) continue;
    const primary = hit.primary_artist?.name ?? "";
    const helper = HELPER_ARTIST.test(primary);
    const titleScore = nameMatch(hit.title ?? "", title);
    // Helper pages put the real artist in the title ("Artist - Song (Romanized)").
    const credit = helper ? hit.title : `${primary}, ${hit.artist_names ?? ""}`;
    const artistScore = Math.max(nameMatch(primary, artist), ...credit.split(/,|&|\(|\)|\bft\.?|\bfeat\.?|-/i).map((n) => nameMatch(n, artist)));
    const titleOk = helper ? clean(hit.title).includes(clean(title)) || titleScore >= 0.5 : titleScore >= 0.7;
    if (!titleOk || artistScore < 0.7) continue;
    const score = titleScore + artistScore - (helper ? 0.3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }
  return best;
}

/** Finds the song on Genius and returns its sections, or null if it can't be found. */
export async function fetchGeniusSections(title: string, artist: string, token: string): Promise<GeniusSection[] | null> {
  const want = { title: clean(title) || title, artist: clean(artist) || artist };
  try {
    let hit: GeniusHit | null = null;
    // Title with artist first; then the title alone, which helps when the artist is spelled differently.
    for (const q of [`${want.title} ${want.artist}`, want.title]) {
      const search = await getJson(`https://api.genius.com/search?q=${encodeURIComponent(q)}`, token);
      hit = pickHit((search?.response?.hits ?? []).map((h: any) => h?.result), title, artist);
      if (hit) break;
    }
    if (!hit) return null;
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

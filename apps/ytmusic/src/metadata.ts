export interface LrclibRecord {
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

const NOISE = /[([][^)\]]*\b(official|video|audio|lyrics?|visuali[sz]er|hd|4k|remaster(ed)?|mv|feat\.?|ft\.?|with)\b[^)\]]*[)\]]/gi;
const ART_HOSTS = new Set(["lh3.googleusercontent.com", "yt3.googleusercontent.com", "i.ytimg.com"]);
const MAX_DURATION_DIFF_S = 8;

/** Removes video-style decoration that lyric databases do not include. */
export function cleanTitle(title: string): string {
  return title.replace(NOISE, "").replace(/\s+/g, " ").trim();
}

export function cleanArtist(artist: string): string {
  return artist.replace(/\s*-\s*Topic$/i, "").trim();
}

/** The player bar's byline reads "Artist • Album • Year", or "Artist • 1.2M views • 3K likes". */
export function parseByline(byline: string): { artist: string; album: string } {
  const parts = byline.split("•").map((p) => p.trim()).filter(Boolean);
  const album = parts[1] ?? "";
  return { artist: cleanArtist(parts[0] ?? ""), album: /^[\d.,]+\s*[KMB]?\s+(views?|likes?)$/i.test(album) ? "" : album };
}

/** Picks the closest-length result, preferring timed lyrics over plain text. */
export function pickBest(results: LrclibRecord[], durationS: number): LrclibRecord | null {
  const usable = results.filter((r) => typeof r.duration === "number" && Math.abs(r.duration - durationS) <= MAX_DURATION_DIFF_S && (r.syncedLyrics || r.plainLyrics));
  const score = (r: LrclibRecord) => (r.syncedLyrics ? 0 : 1000) + Math.abs(r.duration! - durationS);
  return usable.sort((a, b) => score(a) - score(b))[0] ?? null;
}

export function isAllowedArt(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ART_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

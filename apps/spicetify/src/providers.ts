import { argbToHex, buildSyncedLyrics, parseLrc, type Lyrics, type RawLine } from "@bountiful/core";

export interface TrackInfo {
  uri: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  isLocal: boolean;
}

export interface LyricsResult {
  lyrics: Lyrics | null;
  /** Spotify's card colour for this track, used only if art cannot be sampled. */
  fallbackColor: string | null;
}

const LRCLIB_TIMEOUT_MS = 6000;
const CACHE_SIZE = 40;
const cache = new Map<string, LyricsResult>();

const isMusicNote = (s: string) => /^[\s♪♫]*$/.test(s);

/**
 * Spotify's own lyrics. CosmosAsync is the normal route, but it is not always ready (or present
 * after a renderer reload), so fall back to a direct request with the session's token.
 */
async function spotifyLyricsJson(url: string): Promise<any> {
  if (Spicetify.CosmosAsync) return Spicetify.CosmosAsync.get(url);
  const token = Spicetify.Platform?.AuthorizationAPI?.getState?.()?.token?.accessToken;
  if (!token) return null;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, "app-platform": "WebPlayer" } });
  return res.ok ? res.json() : null;
}

async function fromSpotify(track: TrackInfo): Promise<LyricsResult> {
  if (track.isLocal) return { lyrics: null, fallbackColor: null };
  const id = track.uri.split(":").pop();
  try {
    const res = await spotifyLyricsJson(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`);
    const body = res?.lyrics;
    const fallbackColor = typeof res?.colors?.background === "number" ? argbToHex(res.colors.background) : null;
    if (!body?.lines?.length) return { lyrics: null, fallbackColor };
    if (body.syncType === "UNSYNCED") {
      return { lyrics: { kind: "unsynced", source: "Spotify", text: body.lines.map((l: { words: string }) => l.words) }, fallbackColor };
    }
    const raw: RawLine[] = body.lines.map((l: { startTimeMs: string; endTimeMs?: string; words: string }) => {
      const line: RawLine = { startMs: Number(l.startTimeMs), text: isMusicNote(l.words) ? "" : l.words };
      const end = Number(l.endTimeMs);
      if (end > line.startMs) line.endMs = end;
      return line;
    });
    return { lyrics: buildSyncedLyrics(raw, "Spotify", track.durationMs), fallbackColor };
  } catch {
    return { lyrics: null, fallbackColor: null };
  }
}

async function fromLrclib(track: TrackInfo): Promise<Lyrics | null> {
  const query = new URLSearchParams({
    artist_name: track.artist,
    track_name: track.title,
    album_name: track.album,
    duration: String(Math.round(track.durationMs / 1000)),
  });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), LRCLIB_TIMEOUT_MS);
  try {
    const res = await fetch(`https://lrclib.net/api/get?${query}`, { signal: abort.signal });
    if (!res.ok) return null;
    const body = await res.json();
    if (typeof body.syncedLyrics === "string" && body.syncedLyrics.trim()) {
      return buildSyncedLyrics(parseLrc(body.syncedLyrics), "LRCLIB", track.durationMs);
    }
    if (typeof body.plainLyrics === "string" && body.plainLyrics.trim()) {
      return { kind: "unsynced", source: "LRCLIB", text: body.plainLyrics.split(/\r?\n/) };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function rank(lyrics: Lyrics | null): number {
  if (!lyrics) return 0;
  if (lyrics.kind === "unsynced") return 1;
  if (lyrics.lines.length === 0) return 0;
  return lyrics.lines.some((l) => l.timing === "word") ? 3 : 2;
}

export async function loadLyrics(track: TrackInfo): Promise<LyricsResult> {
  const cached = cache.get(track.uri);
  if (cached) return cached;
  const [spotify, lrclib] = await Promise.all([fromSpotify(track), fromLrclib(track)]);
  // Ties go to Spotify. LRCLIB wins when it has real word timing or Spotify has less.
  const lyrics = rank(lrclib) > rank(spotify.lyrics) ? lrclib : spotify.lyrics;
  const result = { lyrics, fallbackColor: spotify.fallbackColor };
  cache.set(track.uri, result);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return result;
}

export async function loadBeats(track: TrackInfo): Promise<number[]> {
  if (track.isLocal) return [];
  try {
    const data = await Spicetify.getAudioData(track.uri);
    return (data?.beats ?? []).map((b) => b.start * 1000);
  } catch {
    return [];
  }
}

export function artUrlFor(track: SpicetifyTrack): string | null {
  const raw = track.metadata.image_xlarge_url ?? track.metadata.image_large_url ?? track.metadata.image_url;
  if (!raw) return null;
  if (raw.startsWith("spotify:image:")) return `https://i.scdn.co/image/${raw.split(":").pop()}`;
  return raw.startsWith("https://") ? raw : null;
}

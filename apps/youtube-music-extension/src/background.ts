/// <reference types="chrome" />
import { paletteFromPixels } from "@bountiful/core/color";
import { cleanArtist, cleanTitle, isAllowedArt, pickBest, type LrclibRecord } from "./metadata";

const TIMEOUT_MS = 6000;
const SIZE = 40;

interface LyricsRequest {
  type: "lyrics";
  title: string;
  artist: string;
  album: string;
  durationS: number;
}

interface PaletteRequest {
  type: "palette";
  url: string;
}

async function fetchJson(url: string): Promise<unknown> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: abort.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function findLyrics(req: LyricsRequest): Promise<LrclibRecord | null> {
  const track = cleanTitle(req.title);
  const artist = cleanArtist(req.artist);
  const exact = new URLSearchParams({ track_name: track, artist_name: artist, duration: String(Math.round(req.durationS)) });
  if (req.album) exact.set("album_name", req.album);
  const direct = (await fetchJson(`https://lrclib.net/api/get?${exact}`)) as LrclibRecord | null;
  if (direct?.syncedLyrics) return direct;
  const results = await fetchJson(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: track, artist_name: artist })}`);
  return (Array.isArray(results) ? pickBest(results as LrclibRecord[], req.durationS) : null) ?? direct;
}

/** Runs here because extension host permissions make the image readable; a page canvas would be tainted. */
async function samplePalette(url: string) {
  if (!isAllowedArt(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
    return paletteFromPixels(ctx.getImageData(0, 0, SIZE, SIZE).data);
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message: LyricsRequest | PaletteRequest, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message.type === "lyrics") {
    void findLyrics(message).then(respond);
    return true;
  }
  if (message.type === "palette") {
    void samplePalette(message.url).then(respond);
    return true;
  }
  return false;
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) void chrome.tabs.sendMessage(tab.id, { type: "toggle" }).catch(() => {});
});

// Alt+L: open or close the lyrics on the active YouTube Music tab.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-lyrics" && tab?.id !== undefined) void chrome.tabs.sendMessage(tab.id, { type: "toggle" }).catch(() => {});
});

/// <reference types="chrome" />
import {
  buildSyncedLyrics,
  CORE_CSS,
  FALLBACK_PALETTE,
  FONT_CSS,
  openSettings,
  OVERLAY_CSS,
  parseLrc,
  PlaybackClock,
  sanitizeSettings,
  Stage,
  type Lyrics,
  type Palette,
  type Settings,
} from "@bountiful/core";
import { isAllowedArt, parseByline, type LrclibRecord } from "./metadata";

const STORAGE_KEY = "settings";
const IDLE_MS = 2800;
const POLL_MS = 1000;
const CACHE_SIZE = 40;

const svg = (path: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${path}"/></svg>`;
const ICONS = {
  star: svg("M12 1 14.6 9.4 23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z"),
  back: svg("M6 5h2v14H6zM20 5v14L9 12z"),
  next: svg("M16 5h2v14h-2zM4 5v14l11-7z"),
  play: svg("M7 4v16l13-8z"),
  pause: svg("M6 4h4v16H6zM14 4h4v16h-4z"),
  gear: svg("M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8.5 5-.9-.5a7.6 7.6 0 0 0 0-2l.9-.5a1 1 0 0 0 .4-1.3l-1.6-2.8a1 1 0 0 0-1.3-.4l-1 .5a7.6 7.6 0 0 0-1.7-1V4a1 1 0 0 0-1-1h-3.2a1 1 0 0 0-1 1v1.5a7.6 7.6 0 0 0-1.7 1l-1-.5a1 1 0 0 0-1.3.4L3.5 9.2a1 1 0 0 0 .4 1.3l.9.5a7.6 7.6 0 0 0 0 2l-.9.5a1 1 0 0 0-.4 1.3l1.6 2.8a1 1 0 0 0 1.3.4l1-.5a7.6 7.6 0 0 0 1.7 1V20a1 1 0 0 0 1 1h3.2a1 1 0 0 0 1-1v-1.5a7.6 7.6 0 0 0 1.7-1l1 .5a1 1 0 0 0 1.3-.4l1.6-2.8a1 1 0 0 0-.4-1.3Z"),
  full: svg("M3 3h7v2H5v5H3zM14 3h7v7h-2V5h-5zM3 14h2v5h5v2H3zM19 14h2v7h-7v-2h5z"),
  close: svg("M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"),
};

const FAB_CSS = `
.bl-fab{position:fixed;right:20px;bottom:100px;z-index:2147482000;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;backdrop-filter:blur(8px)}
.bl-fab:hover{background:rgba(255,255,255,.26)}
.bl-fab svg{width:20px;height:20px;fill:currentColor}
.bl-fab:focus-visible{outline:2px solid #fff;outline-offset:2px}
`;

interface PageTrack {
  key: string;
  title: string;
  artist: string;
  album: string;
  artUrl: string | null;
  isAd: boolean;
}

const text = (selector: string): string => document.querySelector(selector)?.textContent?.trim() ?? "";
const bar = "ytmusic-player-bar";

function readTrack(): PageTrack | null {
  if (document.querySelector("#movie_player.ad-showing")) {
    return { key: "ad", title: "Ad playing", artist: "", album: "", artUrl: null, isAd: true };
  }
  const session = navigator.mediaSession?.metadata;
  const title = session?.title || text(`${bar} .title`);
  if (!title) return null;
  const byline = parseByline(document.querySelector(`${bar} .byline`)?.getAttribute("title") ?? text(`${bar} .byline`));
  const artist = session?.artist || byline.artist;
  const artwork = session?.artwork ? [...session.artwork].pop()?.src : undefined;
  const fallback = document.querySelector<HTMLImageElement>(`${bar} img.image`)?.src;
  const art = artwork ?? fallback;
  return {
    key: `${title}\u0000${artist}`,
    title,
    artist,
    album: session?.album || byline.album,
    artUrl: isAllowedArt(art) ? art : null,
    isAd: false,
  };
}

function toLyrics(record: LrclibRecord | null, durationMs: number): Lyrics | null {
  if (record?.syncedLyrics?.trim()) return buildSyncedLyrics(parseLrc(record.syncedLyrics), "LRCLIB", durationMs);
  if (record?.plainLyrics?.trim()) return { kind: "unsynced", source: "LRCLIB", text: record.plainLyrics.split(/\r?\n/) };
  return null;
}

function div(cls: string, parent: Node): HTMLDivElement {
  const n = document.createElement("div");
  n.className = cls;
  parent.appendChild(n);
  return n;
}

function iconButton(cls: string, label: string, icon: string, parent: Node, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = cls;
  b.setAttribute("aria-label", label);
  b.title = label;
  b.innerHTML = icon; // Only constants from ICONS.
  b.addEventListener("click", onClick);
  parent.appendChild(b);
  return b;
}

class App {
  private settings: Settings = sanitizeSettings({});
  private readonly clock = new PlaybackClock();
  private readonly root: HTMLElement;
  private readonly stage: Stage;
  private readonly plain: HTMLElement;
  private readonly player: HTMLElement;
  private readonly artEl: HTMLImageElement;
  private readonly titleEl: HTMLElement;
  private readonly artistEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly lyricsBtn: HTMLButtonElement;
  private readonly cache = new Map<string, Lyrics | null>();
  private video: HTMLVideoElement | null = null;
  private lyrics: Lyrics | null = null;
  private palette: Palette = FALLBACK_PALETTE;
  private trackKey: string | null = null;
  private loadToken = 0;
  private showLyrics = true;
  private isOpen = false;
  private frame = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // @font-face is ignored inside a shadow root, so fonts go on the document.
    const fonts = document.createElement("style");
    fonts.textContent = FONT_CSS;
    document.head.appendChild(fonts);

    const host = document.createElement("div");
    host.id = "bountiful-lyrics-root";
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CORE_CSS + OVERLAY_CSS + FAB_CSS;
    shadow.appendChild(style);

    iconButton("bl-fab", "Open Bountiful Lyrics", ICONS.star, shadow, () => this.toggle());

    this.root = div("bl-overlay", shadow);
    this.root.hidden = true;
    this.stage = new Stage(this.root, this.settings, { lyrics: true, glow: true, transparent: false });
    this.plain = div("bl-plain", this.root);
    this.player = div("bl-player", this.root);
    this.artEl = document.createElement("img");
    this.artEl.className = "bl-player-art";
    this.artEl.alt = "";
    this.titleEl = document.createElement("h2");
    this.titleEl.className = "bl-player-title";
    this.artistEl = document.createElement("p");
    this.artistEl.className = "bl-player-artist";
    this.statusEl = document.createElement("p");
    this.statusEl.className = "bl-status";
    this.player.append(this.artEl, this.titleEl, this.artistEl, this.statusEl);

    const chrome_ = div("bl-chrome", this.root);
    iconButton("bl-icon-btn", "Previous", ICONS.back, chrome_, () => this.clickBar(".previous-button"));
    this.playBtn = iconButton("bl-icon-btn bl-play", "Play or pause", ICONS.play, chrome_, () => this.togglePlay());
    iconButton("bl-icon-btn", "Next", ICONS.next, chrome_, () => this.clickBar(".next-button"));
    this.lyricsBtn = document.createElement("button");
    this.lyricsBtn.className = "bl-pill";
    this.lyricsBtn.textContent = "Lyrics";
    this.lyricsBtn.addEventListener("click", () => {
      this.showLyrics = !this.showLyrics;
      this.renderView();
    });
    chrome_.append(this.lyricsBtn);
    iconButton("bl-icon-btn", "Settings", ICONS.gear, chrome_, () => openSettings(this.root, this.settings, (patch) => this.updateSettings(patch), null));
    iconButton("bl-icon-btn", "Full screen", ICONS.full, chrome_, () => this.toggleFullscreen());
    iconButton("bl-icon-btn", "Close", ICONS.close, div("bl-close", this.root), () => this.close());

    this.root.addEventListener("mousemove", () => this.wake());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen && !document.fullscreenElement) this.close();
    });
    chrome.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message.type === "toggle") this.toggle();
    });

    void chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      this.settings = sanitizeSettings(stored[STORAGE_KEY]);
      this.stage.applySettings(this.settings);
      this.stage.setBeats([]);
    });

    setInterval(() => this.poll(), POLL_MS);
    this.poll();
  }

  private updateSettings(patch: Partial<Settings>): void {
    this.settings = sanitizeSettings({ ...this.settings, ...patch });
    void chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
    this.stage.applySettings(this.settings);
    this.stage.setBeats([]);
  }

  private clickBar(selector: string): void {
    document.querySelector<HTMLElement>(`${bar} ${selector}`)?.click();
  }

  private togglePlay(): void {
    const button = document.querySelector<HTMLElement>(`${bar} #play-pause-button`);
    if (button) button.click();
    else if (this.video) void (this.video.paused ? this.video.play() : this.video.pause());
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.root.requestFullscreen().catch(() => {});
  }

  private readonly syncFromVideo = (): void => {
    if (this.video) this.clock.sync(this.video.currentTime * 1000, !this.video.paused);
  };

  private readonly forceSync = (): void => {
    if (!this.video) return;
    this.clock.sync(this.video.currentTime * 1000, !this.video.paused, true);
    this.playBtn.innerHTML = this.video.paused ? ICONS.play : ICONS.pause;
  };

  private bindVideo(): void {
    const video = document.querySelector("video");
    if (video === this.video) return;
    for (const [event, fn] of this.videoEvents()) this.video?.removeEventListener(event, fn);
    this.video = video;
    for (const [event, fn] of this.videoEvents()) video?.addEventListener(event, fn);
    this.forceSync();
  }

  private videoEvents(): Array<[string, () => void]> {
    return [
      ["timeupdate", this.syncFromVideo],
      ["seeked", this.forceSync],
      ["play", this.forceSync],
      ["pause", this.forceSync],
    ];
  }

  private poll(): void {
    this.bindVideo();
    const track = readTrack();
    // The old video's duration lingers briefly, so wait for a real one before searching.
    if (!track || track.key === this.trackKey) return;
    if (!track.isAd && !(this.video && Number.isFinite(this.video.duration) && this.video.duration > 0)) return;
    void this.load(track);
  }

  private async load(track: PageTrack): Promise<void> {
    this.trackKey = track.key;
    const token = ++this.loadToken;
    this.forceSync();
    this.titleEl.textContent = track.title;
    this.artistEl.textContent = track.artist;
    if (track.artUrl) this.artEl.src = track.artUrl;
    else this.artEl.removeAttribute("src");
    this.stage.setArt(track.artUrl);
    this.lyrics = null;
    this.stage.setLyrics(null);
    this.statusEl.textContent = track.isAd ? "" : "Finding lyrics";
    this.plain.replaceChildren();
    this.renderView();
    if (track.isAd) return;

    const durationS = this.video?.duration ?? 0;
    const [lyrics, palette] = await Promise.all([
      this.fetchLyrics(track, durationS),
      track.artUrl ? (chrome.runtime.sendMessage({ type: "palette", url: track.artUrl }) as Promise<Palette | null>).catch(() => null) : Promise.resolve(null),
    ]);
    if (token !== this.loadToken) return;
    this.lyrics = lyrics;
    this.palette = palette ?? FALLBACK_PALETTE;
    this.stage.setPalette(this.palette);
    this.stage.setLyrics(lyrics?.kind === "synced" ? lyrics : null);
    this.statusEl.textContent = lyrics ? "" : "No lyrics found for this track";
    this.renderPlain();
    this.renderView();
  }

  private async fetchLyrics(track: PageTrack, durationS: number): Promise<Lyrics | null> {
    if (this.cache.has(track.key)) return this.cache.get(track.key) ?? null;
    let record: LrclibRecord | null = null;
    try {
      record = await chrome.runtime.sendMessage({ type: "lyrics", title: track.title, artist: track.artist, album: track.album, durationS });
    } catch {
      return null;
    }
    const lyrics = toLyrics(record, durationS * 1000);
    this.cache.set(track.key, lyrics);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
    return lyrics;
  }

  private renderPlain(): void {
    this.plain.replaceChildren();
    if (this.lyrics?.kind !== "unsynced") return;
    for (const line of this.lyrics.text) {
      const p = document.createElement("p");
      p.textContent = line;
      this.plain.appendChild(p);
    }
    const note = document.createElement("small");
    note.textContent = `Timed lyrics are not available. Text from ${this.lyrics.source}.`;
    this.plain.appendChild(note);
  }

  private renderView(): void {
    const kind = this.lyrics?.kind;
    const wantLyrics = this.showLyrics && !!kind;
    this.player.hidden = wantLyrics;
    this.plain.hidden = !(wantLyrics && kind === "unsynced");
    (this.stage.el.querySelector(".bl-lyrics") as HTMLElement).style.visibility = wantLyrics && kind === "synced" ? "" : "hidden";
    this.lyricsBtn.setAttribute("aria-pressed", String(wantLyrics));
    this.lyricsBtn.disabled = !kind;
  }

  private wake(): void {
    this.root.classList.remove("bl-idle");
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.root.classList.add("bl-idle"), IDLE_MS);
  }

  private readonly tick = (): void => {
    if (!this.isOpen) return;
    this.stage.update(this.clock.position());
    this.frame = requestAnimationFrame(this.tick);
  };

  private toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.root.hidden = false;
    this.forceSync();
    this.renderView();
    this.wake();
    this.frame = requestAnimationFrame(this.tick);
  }

  private close(): void {
    this.isOpen = false;
    this.root.hidden = true;
    cancelAnimationFrame(this.frame);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (document.fullscreenElement) void document.exitFullscreen();
  }
}

new App();

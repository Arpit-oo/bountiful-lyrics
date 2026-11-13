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
  volume: svg("M3 9h4l5-4v14l-5-4H3zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 5.6a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-9.9z"),
  muted: svg("M3 9h4l5-4v14l-5-4H3zM15.3 9.7l1.4-1.4L19 10.6l2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"),
  queue: svg("M3 5h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm13 0v6l5-3z"),
  lyrics: svg("M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4z"),
};

const FAB_CSS = `
.bl-fab{position:fixed;right:20px;bottom:100px;z-index:2147482000;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;backdrop-filter:blur(8px)}
.bl-fab:hover{background:rgba(255,255,255,.26)}
.bl-fab svg{width:20px;height:20px;fill:currentColor}
.bl-fab:focus-visible{outline:2px solid #fff;outline-offset:2px}
.bl-overlay[data-mode="fullscreen"] .bl-close{right:auto;left:18px;flex-direction:row-reverse}
.bl-queue{position:absolute;left:0;top:0;bottom:0;z-index:4;width:min(380px,86vw);display:flex;flex-direction:column;background:rgba(14,14,18,.86);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-right:1px solid rgba(255,255,255,.08);transform:translateX(-102%);transition:transform .35s cubic-bezier(.16,1,.3,1);font-family:"BL Jakarta","Segoe UI",sans-serif}
.bl-queue.bl-open{transform:none}
.bl-queue-head{display:flex;align-items:center;justify-content:space-between;padding:22px 20px 12px}
.bl-queue-head h3{margin:0;font-size:13px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.bl-queue-list{flex:1;overflow-y:auto;padding:0 10px 110px;scrollbar-width:thin}
.bl-queue-item{display:flex;align-items:center;gap:12px;width:100%;padding:8px 10px;border:0;border-radius:12px;background:transparent;color:#fff;text-align:left;cursor:pointer;transition:background-color .15s ease}
.bl-queue-item:hover{background:rgba(255,255,255,.08)}
.bl-queue-item[aria-current="true"]{background:rgba(255,255,255,.12)}
.bl-queue-item img{width:44px;height:44px;flex:none;border-radius:7px;object-fit:cover;background:#222}
.bl-queue-text{min-width:0;flex:1}
.bl-queue-text b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-queue-text span{display:block;font-size:12.5px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-queue-time{font-size:12px;color:rgba(255,255,255,.5);font-variant-numeric:tabular-nums}
.bl-queue-empty{padding:20px;font-size:13.5px;line-height:1.55;color:rgba(255,255,255,.55)}
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
  private readonly miniArt: HTMLImageElement;
  private readonly miniTitle: HTMLElement;
  private readonly miniArtist: HTMLElement;
  private readonly seek: HTMLInputElement;
  private readonly elapsedEl: HTMLElement;
  private readonly durationEl: HTMLElement;
  private readonly volume: HTMLInputElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly queue: HTMLElement;
  private readonly queueList: HTMLElement;
  private readonly toast: HTMLElement;
  private seeking = false;
  private lastUi = 0;
  private queueTimer: ReturnType<typeof setInterval> | null = null;
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

    // Up next: YouTube Music's own queue, so you can switch songs without leaving the lyrics.
    this.queue = div("bl-queue", this.root);
    const qHead = div("bl-queue-head", this.queue);
    qHead.append(Object.assign(document.createElement("h3"), { textContent: "Up next" }));
    iconButton("bl-icon-btn bl-icon-sm", "Hide up next", ICONS.close, qHead, () => this.toggleQueue(false));
    this.queueList = div("bl-queue-list", this.queue);

    // Bottom bar: now playing | transport + seek | volume, queue, lyrics, settings, fullscreen.
    const chrome_ = div("bl-chrome", this.root);
    const left = div("bl-chrome-left", chrome_);
    this.miniArt = document.createElement("img");
    this.miniArt.className = "bl-mini-art";
    this.miniArt.alt = "";
    left.appendChild(this.miniArt);
    const meta = div("bl-mini-meta", left);
    this.miniTitle = div("bl-mini-title", meta);
    this.miniArtist = div("bl-mini-artist", meta);
    const center = div("bl-chrome-center", chrome_);
    const transport = div("bl-transport", center);
    iconButton("bl-icon-btn", "Previous", ICONS.back, transport, () => this.clickBar(".previous-button"));
    this.playBtn = iconButton("bl-icon-btn bl-play", "Play or pause", ICONS.play, transport, () => this.togglePlay());
    iconButton("bl-icon-btn", "Next", ICONS.next, transport, () => this.clickBar(".next-button"));
    const seekRow = div("bl-seek-row", center);
    this.elapsedEl = div("bl-time", seekRow);
    this.seek = this.range("bl-seek", "Seek", seekRow);
    this.durationEl = div("bl-time", seekRow);
    this.seek.addEventListener("input", () => {
      this.seeking = true;
      this.paintRange(this.seek);
    });
    this.seek.addEventListener("change", () => {
      if (this.video && Number.isFinite(this.video.duration)) this.video.currentTime = (Number(this.seek.value) / 1000) * this.video.duration;
      this.seeking = false;
    });
    const right = div("bl-chrome-right", chrome_);
    const vol = div("bl-volume", right);
    this.muteBtn = iconButton("bl-icon-btn bl-icon-sm", "Mute", ICONS.volume, vol, () => {
      if (this.video) this.video.muted = !this.video.muted;
      this.paintVolume();
    });
    this.volume = this.range("bl-vol", "Volume", vol);
    this.volume.addEventListener("input", () => {
      if (this.video) {
        this.video.volume = Number(this.volume.value) / 1000;
        this.video.muted = false;
      }
      this.paintVolume();
    });
    iconButton("bl-icon-btn bl-icon-sm", "Up next (Q)", ICONS.queue, right, () => this.toggleQueue());
    this.lyricsBtn = iconButton("bl-icon-btn bl-icon-sm bl-toggle-btn", "Show lyrics (L)", ICONS.lyrics, right, () => {
      this.showLyrics = !this.showLyrics;
      this.renderView();
    });
    iconButton("bl-icon-btn bl-icon-sm", "Settings (S)", ICONS.gear, right, () => this.openSettings());
    iconButton("bl-icon-btn bl-icon-sm", "Full screen (F)", ICONS.full, right, () => this.toggleFullscreen());
    const closeHolder = div("bl-close", this.root);
    closeHolder.append(Object.assign(document.createElement("span"), { className: "bl-close-hint", textContent: "Esc · back to YouTube Music" }));
    iconButton("bl-icon-btn", "Back to YouTube Music (Esc)", ICONS.close, closeHolder, () => this.close());
    this.toast = div("bl-toast", this.root);
    this.root.dataset.mode = "fullscreen";

    this.root.addEventListener("mousemove", () => this.wake());
    document.addEventListener("keydown", this.onKey, true);
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

  private openSettings(): void {
    openSettings(this.root, this.settings, (patch) => this.updateSettings(patch), null);
  }

  private range(cls: string, label: string, parent: Node): HTMLInputElement {
    const i = document.createElement("input");
    i.type = "range";
    i.className = cls;
    i.min = "0";
    i.max = "1000";
    i.setAttribute("aria-label", label);
    parent.appendChild(i);
    return i;
  }

  private paintRange(input: HTMLInputElement): void {
    input.style.setProperty("--bl-fill", `${Number(input.value) / 10}%`);
  }

  private paintVolume(): void {
    const v = this.video;
    const level = v ? (v.muted ? 0 : v.volume) : 1;
    // Duck-typed: Firefox wraps page objects for extensions, so instanceof checks are unreliable.
    const active = (this.root.getRootNode() as Document | ShadowRoot).activeElement;
    if (active !== this.volume) this.volume.value = String(Math.round(level * 1000));
    this.paintRange(this.volume);
    this.muteBtn.innerHTML = level <= 0.001 ? ICONS.muted : ICONS.volume;
  }

  private paintSeek(): void {
    const v = this.video;
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    if (!v || !Number.isFinite(v.duration)) return;
    this.durationEl.textContent = fmt(v.duration);
    if (this.seeking) return;
    this.elapsedEl.textContent = fmt(v.currentTime);
    this.seek.value = String(Math.round((v.currentTime / v.duration) * 1000));
    this.paintRange(this.seek);
  }

  private showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add("bl-toast-on");
    setTimeout(() => this.toast.classList.remove("bl-toast-on"), 2200);
  }

  /** Mirrors YouTube Music's queue (including autoplay suggestions). Clicking a row plays it. */
  private renderQueue(): void {
    const items = [...document.querySelectorAll<HTMLElement>("ytmusic-player-queue ytmusic-player-queue-item")];
    this.queueList.replaceChildren();
    if (items.length === 0) {
      this.queueList.append(Object.assign(document.createElement("p"), { className: "bl-queue-empty", textContent: "Nothing queued yet. Open the YouTube Music player once (click the song in the bottom bar) and Up next will appear here." }));
      return;
    }
    for (const item of items) {
      const row = document.createElement("button");
      row.className = "bl-queue-item";
      row.setAttribute("aria-current", String(item.hasAttribute("selected") || item.getAttribute("play-button-state") === "playing" || item.getAttribute("play-button-state") === "paused"));
      const thumb = item.querySelector<HTMLImageElement>("img")?.src;
      const img = document.createElement("img");
      img.alt = "";
      if (thumb && /^https:\/\/(i\.ytimg\.com|lh3\.googleusercontent\.com|yt3\.googleusercontent\.com)\//.test(thumb)) img.src = thumb;
      const text = div("bl-queue-text", row);
      text.append(Object.assign(document.createElement("b"), { textContent: item.querySelector(".song-title")?.textContent?.trim() ?? "" }), Object.assign(document.createElement("span"), { textContent: item.querySelector(".byline")?.textContent?.trim() ?? "" }));
      row.prepend(img);
      row.append(Object.assign(document.createElement("span"), { className: "bl-queue-time", textContent: item.querySelector(".duration")?.textContent?.trim() ?? "" }));
      row.addEventListener("click", () => {
        (item.querySelector<HTMLElement>(".song-info") ?? item.querySelector<HTMLElement>("ytmusic-play-button-renderer") ?? item).click();
        setTimeout(() => this.renderQueue(), 700);
      });
      this.queueList.append(row);
    }
  }

  private toggleQueue(force?: boolean): void {
    const open = force ?? !this.queue.classList.contains("bl-open");
    this.queue.classList.toggle("bl-open", open);
    if (this.queueTimer) clearInterval(this.queueTimer);
    this.queueTimer = null;
    if (open) {
      this.renderQueue();
      this.queueTimer = setInterval(() => this.renderQueue(), 4000);
    }
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey) return;
    if (e.altKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      this.toggle();
      return;
    }
    if (!this.isOpen || e.altKey) return;
    const path = e.composedPath()[0] as HTMLElement | undefined;
    if (path && /^(INPUT|SELECT|TEXTAREA)$/.test(path.tagName) && e.key !== "Escape") return;
    if (this.root.querySelector(".bl-scrim")) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const styles = ["constellation", "garden", "fisheye", "codestyle"] as const;
    let used = true;
    if (key === "Escape") {
      if (document.fullscreenElement) void document.exitFullscreen();
      else this.close();
    } else if (key === " ") this.togglePlay();
    else if (key === "s" || key === ",") this.openSettings();
    else if (key === "q") this.toggleQueue();
    else if (key === "f") this.toggleFullscreen();
    else if (key === "l") {
      this.showLyrics = !this.showLyrics;
      this.renderView();
    } else if (key === "b") this.updateSettings({ background: this.settings.background === "art" ? "auto" : "art" });
    else if (key >= "1" && key <= "4") {
      const style = styles[Number(key) - 1]!;
      this.updateSettings({ style });
      this.showToast(style[0]!.toUpperCase() + style.slice(1));
    } else if ((key === "ArrowLeft" || key === "ArrowRight") && this.video) this.video.currentTime = Math.max(0, this.video.currentTime + (key === "ArrowLeft" ? -5 : 5));
    else if ((key === "ArrowUp" || key === "ArrowDown") && this.video) {
      this.video.volume = Math.min(1, Math.max(0, this.video.volume + (key === "ArrowUp" ? 0.05 : -0.05)));
      this.paintVolume();
      this.showToast(`Volume ${Math.round(this.video.volume * 100)}%`);
    } else if (key === "m" && this.video) {
      this.video.muted = !this.video.muted;
      this.paintVolume();
    } else used = false;
    if (used) {
      e.preventDefault();
      e.stopPropagation();
      this.wake();
    }
  };

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
    this.miniTitle.textContent = track.title;
    this.miniArtist.textContent = track.artist;
    for (const img of [this.artEl, this.miniArt]) {
      if (track.artUrl) img.src = track.artUrl;
      else img.removeAttribute("src");
    }
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
    const now = performance.now();
    if (now - this.lastUi > 250) {
      this.lastUi = now;
      this.paintSeek();
    }
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
    this.paintVolume();
    this.wake();
    this.frame = requestAnimationFrame(this.tick);
    if (!sessionStorage.getItem("bl-hinted")) {
      sessionStorage.setItem("bl-hinted", "1");
      this.showToast("Esc to go back · Alt+L to reopen · Q for up next");
    }
  }

  private close(): void {
    this.isOpen = false;
    this.root.hidden = true;
    cancelAnimationFrame(this.frame);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (document.fullscreenElement) void document.exitFullscreen();
    this.toggleQueue(false);
  }
}

new App();

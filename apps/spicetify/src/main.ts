import {
  CORE_CSS,
  FALLBACK_PALETTE,
  FONT_CSS,
  mix,
  openSettings,
  OVERLAY_CSS,
  paletteFromPixels,
  PlaybackClock,
  sanitizeSettings,
  Stage,
  GLOW_ANIMATIONS,
  STYLE_IDS,
  type DisplayId,
  type Lyrics,
  type Palette,
  type Settings,
} from "@bountiful/core";
import { CompanionLink } from "./companion";
import { artUrlFor, loadBeats, loadLyrics, type TrackInfo } from "./providers";

const STORAGE_KEY = "bountiful-lyrics:settings";
const IDLE_MS = 2800;
const COMPANION_CLOCK_MS = 1000;
const SEEK_UI_MS = 250;
const POPOUT_KEY = "bountiful-lyrics:popout";
const POPOUT_DEFAULT = { width: 1040, height: 640 };
const POPOUT_MIN = { width: 420, height: 260 };
const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type Edge = (typeof EDGES)[number];

const svg = (path: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${path}"/></svg>`;
const ICONS = {
  back: svg("M6 5h2v14H6zM20 5v14L9 12z"),
  next: svg("M16 5h2v14h-2zM4 5v14l11-7z"),
  play: svg("M7 4v16l13-8z"),
  pause: svg("M6 4h4v16H6zM14 4h4v16h-4z"),
  gear: svg("M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8.5 5-.9-.5a7.6 7.6 0 0 0 0-2l.9-.5a1 1 0 0 0 .4-1.3l-1.6-2.8a1 1 0 0 0-1.3-.4l-1 .5a7.6 7.6 0 0 0-1.7-1V4a1 1 0 0 0-1-1h-3.2a1 1 0 0 0-1 1v1.5a7.6 7.6 0 0 0-1.7 1l-1-.5a1 1 0 0 0-1.3.4L3.5 9.2a1 1 0 0 0 .4 1.3l.9.5a7.6 7.6 0 0 0 0 2l-.9.5a1 1 0 0 0-.4 1.3l1.6 2.8a1 1 0 0 0 1.3.4l1-.5a7.6 7.6 0 0 0 1.7 1V20a1 1 0 0 0 1 1h3.2a1 1 0 0 0 1-1v-1.5a7.6 7.6 0 0 0 1.7-1l1 .5a1 1 0 0 0 1.3-.4l1.6-2.8a1 1 0 0 0-.4-1.3Z"),
  close: svg("M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"),
  volume: svg("M3 9h4l5-4v14l-5-4H3zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 5.6a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-9.9z"),
  muted: svg("M3 9h4l5-4v14l-5-4H3zM15.3 9.7l1.4-1.4L19 10.6l2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"),
  page: svg("M3 4h18v16H3zm2 2v12h3V6zm5 0v12h9V6z"),
  fullscreen: svg("M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5z"),
  window: svg("M14 3h7v7h-2V6.4l-7.3 7.3-1.4-1.4L17.6 5H14zM3 6h8v2H5v11h11v-6h2v8H3z"),
  lyrics: svg("M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4z"),
  sparkle: svg("M12 1c.6 6.4 4.6 10.4 11 11-6.4.6-10.4 4.6-11 11-.6-6.4-4.6-10.4-11-11 6.4-.6 10.4-4.6 11-11Z"),
};
const TOPBAR_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0 9.8 6.2 16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z"/></svg>`;
const MODE_LABELS: Record<DisplayId, string> = { page: "Show inside Spotify", fullscreen: "Fullscreen", window: "Pop out to a window" };

function div(cls: string, parent: HTMLElement): HTMLDivElement {
  const n = document.createElement("div");
  n.className = cls;
  parent.appendChild(n);
  return n;
}

function iconButton(cls: string, label: string, icon: string, parent: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = cls;
  b.setAttribute("aria-label", label);
  b.title = label;
  b.innerHTML = icon; // Only constants from ICONS.
  b.addEventListener("click", onClick);
  parent.appendChild(b);
  return b;
}

function range(cls: string, label: string, parent: HTMLElement): HTMLInputElement {
  const i = document.createElement("input");
  i.type = "range";
  i.className = cls;
  i.min = "0";
  i.max = "1000";
  i.step = "1";
  i.setAttribute("aria-label", label);
  parent.appendChild(i);
  return i;
}

const formatTime = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

async function sampleArt(url: string): Promise<Palette | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("art failed to load"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 40;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 40, 40);
    return paletteFromPixels(ctx.getImageData(0, 0, 40, 40).data);
  } catch {
    return null;
  }
}

function currentTrack(): { track: TrackInfo; raw: SpicetifyTrack } | null {
  const item = Spicetify.Player.data?.item;
  if (!item?.uri) return null;
  return {
    raw: item,
    track: {
      uri: item.uri,
      title: item.name ?? item.metadata.title ?? "",
      artist: item.artists?.[0]?.name ?? item.metadata.artist_name ?? "",
      album: item.album?.name ?? item.metadata.album_title ?? "",
      durationMs: Spicetify.Player.getDuration(),
      isLocal: item.uri.startsWith("spotify:local:"),
    },
  };
}

class App {
  private settings: Settings = this.loadSettings();
  private readonly clock = new PlaybackClock();
  private readonly css = document.createElement("style");
  private readonly root = document.createElement("div");
  private readonly stage: Stage;
  private readonly player: HTMLElement;
  private readonly plain: HTMLElement;
  private readonly artEl: HTMLImageElement;
  private readonly titleEl: HTMLElement;
  private readonly artistEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly miniArt: HTMLImageElement;
  private readonly miniTitle: HTMLElement;
  private readonly miniArtist: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly lyricsBtn: HTMLButtonElement;
  private readonly seek: HTMLInputElement;
  private readonly elapsedEl: HTMLElement;
  private readonly durationEl: HTMLElement;
  private readonly volume: HTMLInputElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly modeBtns: Record<DisplayId, HTMLButtonElement>;
  private readonly bgBtn: HTMLButtonElement;
  private readonly toast: HTMLElement;
  private drag: { kind: "move" | Edge; sx: number; sy: number; x: number; y: number; w: number; h: number; target?: { x: number; y: number; w: number; h: number } } | null = null;
  private readonly companion = new CompanionLink(() => this.pushAll());
  private lyrics: Lyrics | null = null;
  private palette: Palette = FALLBACK_PALETTE;
  private artUrl: string | null = null;
  private beats: number[] = [];
  private trackUri: string | null = null;
  private loadToken = 0;
  private showLyrics = true;
  private isOpen = false;
  private mode: DisplayId | null = null;
  private pip: Window | null = null;
  private frame = 0;
  private frameView: Window = window;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private previewMs: number | null = null;
  private seeking = false;
  private lastSeekUi = 0;
  private volumeBeforeMute = 0.6;

  constructor() {
    this.css.textContent = FONT_CSS + CORE_CSS + OVERLAY_CSS;
    document.head.appendChild(this.css);

    this.root.className = "bl-overlay";
    this.root.hidden = true;
    document.body.appendChild(this.root);
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

    // Bottom bar: now playing | transport + seek | volume, view and settings.
    const chrome = div("bl-chrome", this.root);
    const left = div("bl-chrome-left", chrome);
    this.miniArt = document.createElement("img");
    this.miniArt.className = "bl-mini-art";
    this.miniArt.alt = "";
    left.appendChild(this.miniArt);
    const meta = div("bl-mini-meta", left);
    this.miniTitle = div("bl-mini-title", meta);
    this.miniArtist = div("bl-mini-artist", meta);

    const center = div("bl-chrome-center", chrome);
    const transport = div("bl-transport", center);
    iconButton("bl-icon-btn", "Previous", ICONS.back, transport, () => Spicetify.Player.back());
    this.playBtn = iconButton("bl-icon-btn bl-play", "Play or pause", ICONS.play, transport, () => Spicetify.Player.togglePlay());
    iconButton("bl-icon-btn", "Next", ICONS.next, transport, () => Spicetify.Player.next());
    const seekRow = div("bl-seek-row", center);
    this.elapsedEl = div("bl-time", seekRow);
    this.seek = range("bl-seek", "Seek", seekRow);
    this.durationEl = div("bl-time", seekRow);
    this.seek.addEventListener("input", () => {
      this.seeking = true;
      this.paintRange(this.seek);
      this.elapsedEl.textContent = formatTime((Number(this.seek.value) / 1000) * Spicetify.Player.getDuration());
    });
    this.seek.addEventListener("change", () => {
      Spicetify.Player.seek((Number(this.seek.value) / 1000) * Spicetify.Player.getDuration());
      this.seeking = false;
    });

    const right = div("bl-chrome-right", chrome);
    const vol = div("bl-volume", right);
    this.muteBtn = iconButton("bl-icon-btn bl-icon-sm", "Mute", ICONS.volume, vol, () => this.toggleMute());
    this.volume = range("bl-vol", "Volume", vol);
    this.volume.addEventListener("input", () => {
      Spicetify.Player.setVolume(Number(this.volume.value) / 1000);
      this.paintVolume(Number(this.volume.value) / 1000);
    });
    this.volume.addEventListener("wheel", (e) => {
      e.preventDefault();
      const next = Math.min(1, Math.max(0, Spicetify.Player.getVolume() - Math.sign(e.deltaY) * 0.05));
      Spicetify.Player.setVolume(next);
      this.paintVolume(next);
    }, { passive: false });

    this.lyricsBtn = iconButton("bl-icon-btn bl-icon-sm bl-toggle-btn", "Show lyrics", ICONS.lyrics, right, () => {
      this.showLyrics = !this.showLyrics;
      this.renderView();
    });
    // One tap swaps the backdrop between the album art (frosted) and the style's own backdrop.
    this.bgBtn = iconButton("bl-icon-btn bl-icon-sm bl-bg-btn", "Album art background", "", right, () => {
      this.updateSettings({ background: this.settings.background === "art" ? "auto" : "art" });
    });
    const modes = div("bl-modes", right);
    this.modeBtns = {
      page: iconButton("bl-icon-btn bl-icon-sm", MODE_LABELS.page, ICONS.page, modes, () => this.switchMode("page")),
      fullscreen: iconButton("bl-icon-btn bl-icon-sm", MODE_LABELS.fullscreen, ICONS.fullscreen, modes, () => this.switchMode("fullscreen")),
      window: iconButton("bl-icon-btn bl-icon-sm", MODE_LABELS.window, ICONS.window, modes, () => this.switchMode("window")),
    };
    if (!window.documentPictureInPicture) this.modeBtns.window.hidden = true;
    iconButton("bl-icon-btn bl-icon-sm", "Settings", ICONS.gear, right, () => this.openSettings());

    for (const edge of EDGES) div(`bl-win-edge bl-win-${edge}`, this.root).dataset.edge = edge;
    this.toast = div("bl-toast", this.root);
    this.root.addEventListener("pointerdown", this.onPointerDown);
    this.root.addEventListener("pointermove", this.onPointerMove);
    this.root.addEventListener("pointerup", this.onPointerUp);
    this.root.addEventListener("pointercancel", this.onPointerUp);
    this.root.addEventListener("dblclick", (e) => {
      if (this.mode === "window" && !(e.target as HTMLElement).closest("button,input,select,.bl-dialog,.bl-chrome")) this.switchMode("fullscreen");
    });

    const closeHolder = div("bl-close", this.root);
    closeHolder.append(Object.assign(document.createElement("span"), { className: "bl-close-hint", textContent: "Esc" }));
    iconButton("bl-icon-btn", "Close lyrics (Esc)", ICONS.close, closeHolder, () => this.close());

    this.root.addEventListener("mousemove", () => this.wake());
    this.root.addEventListener("mousedown", () => this.wake());
    document.addEventListener("keydown", this.onKey);

    Spicetify.Player.addEventListener("songchange", () => this.onSongChange());
    Spicetify.Player.addEventListener("onplaypause", () => this.onPlayPause());
    Spicetify.Player.addEventListener("onprogress", () => this.syncClock(false));
    new Spicetify.Topbar.Button("Bountiful Lyrics", TOPBAR_ICON, () => this.toggle());
    // A lyrics page behaves like any Spotify page: navigating away closes it.
    Spicetify.Platform?.History?.listen(() => {
      if (this.isOpen && this.mode === "page") this.close();
    });

    setInterval(() => {
      // At startup the restored track can appear with no songchange event.
      const uri = Spicetify.Player.data?.item?.uri;
      if (uri && uri !== this.trackUri) void this.onSongChange();
      if (this.companion.connected) this.companion.send({ type: "clock", positionMs: this.clock.position(), playing: this.clock.isPlaying() });
      if (this.isOpen) this.paintVolume(Spicetify.Player.getVolume());
    }, COMPANION_CLOCK_MS);

    this.companion.setEnabled(this.settings.companion);
    this.onSongChange();

    window.BountifulLyrics = {
      open: (mode?: DisplayId) => this.open(mode),
      close: () => this.close(),
      renderAt: (ms: number | null) => {
        this.previewMs = ms;
      },
      update: (patch: Partial<Settings>) => this.updateSettings(patch),
      state: () => ({ track: this.trackUri, lyricsKind: this.lyrics?.kind ?? null, source: this.lyrics?.source ?? null, palette: this.palette, beats: this.beats.length, position: this.clock.position(), companion: this.companion.connected, mode: this.mode, open: this.isOpen }),
    };
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.isOpen || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) && e.key !== "Escape") return;
    if (this.root.querySelector(".bl-scrim")) return; // The settings dialog handles its own keys.
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const handled = this.shortcut(key);
    if (handled) {
      e.preventDefault();
      this.wake();
    }
  };

  /** Keyboard shortcuts while the lyrics are open. Returns true when the key was used. */
  private shortcut(key: string): boolean {
    const step = (list: readonly string[], current: string) => list[(list.indexOf(current) + 1) % list.length]!;
    switch (key) {
      case "Escape":
        this.close();
        return true;
      case " ":
        if (this.mode === "page") return false; // Spotify's own space handling stays in charge.
        Spicetify.Player.togglePlay();
        return true;
      case "s":
      case ",":
        this.openSettings();
        return true;
      case "f":
        this.switchMode(this.mode === "fullscreen" ? "page" : "fullscreen");
        return true;
      case "p":
        if (window.documentPictureInPicture) this.switchMode(this.mode === "window" ? "page" : "window");
        return true;
      case "i":
        this.switchMode("page");
        return true;
      case "l":
        this.showLyrics = !this.showLyrics;
        this.renderView();
        return true;
      case "b":
        this.updateSettings({ background: this.settings.background === "art" ? "auto" : "art" });
        this.showToast(this.settings.background === "art" ? "Album art background" : "Style backdrop");
        return true;
      case "g": {
        const glowAnimation = step(GLOW_ANIMATIONS, this.settings.glowAnimation) as Settings["glowAnimation"];
        this.updateSettings({ glowAnimation });
        this.showToast(`Glow: ${{ music: "Music Sync", orbit: "Orbit", default: "Breathe", idle: "Drift", none: "Still" }[glowAnimation]}`);
        return true;
      }
      case "1":
      case "2":
      case "3":
      case "4": {
        const style = STYLE_IDS[Number(key) - 1]!;
        this.updateSettings({ style });
        this.showToast(style[0]!.toUpperCase() + style.slice(1));
        return true;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        const delta = key === "ArrowLeft" ? -5000 : 5000;
        Spicetify.Player.seek(Math.max(0, Math.min(Spicetify.Player.getDuration(), Spicetify.Player.getProgress() + delta)));
        return true;
      }
      case "ArrowUp":
      case "ArrowDown": {
        const v = Math.min(1, Math.max(0, Spicetify.Player.getVolume() + (key === "ArrowUp" ? 0.05 : -0.05)));
        Spicetify.Player.setVolume(v);
        this.paintVolume(v);
        this.showToast(`Volume ${Math.round(v * 100)}%`);
        return true;
      }
      case "m":
        this.toggleMute();
        return true;
      default:
        return false;
    }
  }

  private loadSettings(): Settings {
    try {
      return sanitizeSettings(JSON.parse(Spicetify.LocalStorage.get(STORAGE_KEY) ?? "{}"));
    } catch {
      return sanitizeSettings({});
    }
  }

  private updateSettings(patch: Partial<Settings>): void {
    const displayChanged = patch.display !== undefined && patch.display !== this.settings.display;
    this.settings = sanitizeSettings({ ...this.settings, ...patch });
    try {
      Spicetify.LocalStorage.set(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Storage can be full; the change still applies for this session.
    }
    this.stage.applySettings(this.settings);
    this.stage.setBeats(this.beats);
    this.paintBgButton();
    this.companion.setEnabled(this.settings.companion);
    this.companion.send({ type: "settings", settings: this.settings });
    // Picking "Open in" from settings moves the view right away (pop-out needs this click).
    if (displayChanged && this.isOpen && this.mode !== this.settings.display) void this.open(this.settings.display);
  }

  private openSettings(): void {
    openSettings(this.root, this.settings, (patch) => this.updateSettings(patch), this.companion.connected, { display: true });
  }

  private syncClock(force: boolean): void {
    this.clock.sync(Spicetify.Player.getProgress(), Spicetify.Player.isPlaying(), force);
  }

  private onPlayPause(): void {
    this.syncClock(true);
    const playing = Spicetify.Player.isPlaying();
    this.playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
    this.playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    this.companion.send({ type: "clock", positionMs: this.clock.position(), playing: this.clock.isPlaying() });
  }

  private toggleMute(): void {
    const current = Spicetify.Player.getVolume();
    if (current > 0.001) {
      this.volumeBeforeMute = current;
      Spicetify.Player.setVolume(0);
      this.paintVolume(0);
    } else {
      Spicetify.Player.setVolume(this.volumeBeforeMute || 0.5);
      this.paintVolume(this.volumeBeforeMute || 0.5);
    }
  }

  private paintBgButton(): void {
    const art = this.settings.background === "art";
    this.bgBtn.replaceChildren();
    this.bgBtn.setAttribute("aria-pressed", String(art));
    this.bgBtn.title = art ? "Back to the style's backdrop" : "Use album art as the background";
    this.bgBtn.setAttribute("aria-label", this.bgBtn.title);
    if (art || !this.artUrl) {
      this.bgBtn.innerHTML = ICONS.sparkle; // Constant markup only.
    } else {
      const img = document.createElement("img");
      img.alt = "";
      img.src = this.artUrl;
      this.bgBtn.appendChild(img);
    }
  }

  private showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add("bl-toast-on");
    setTimeout(() => this.toast.classList.remove("bl-toast-on"), 3600);
  }

  /** The pop-out has no OS title bar, so the whole window drags and its edges resize it. */
  private onPointerDown = (e: PointerEvent): void => {
    const pip = this.pip;
    if (this.mode !== "window" || !pip || e.button !== 0) return;
    const target = e.target as HTMLElement;
    const edge = target.closest<HTMLElement>(".bl-win-edge")?.dataset.edge as Edge | undefined;
    if (!edge && target.closest("button,input,select,a,.bl-dialog,.bl-scrim")) return;
    this.drag = { kind: edge ?? "move", sx: e.screenX, sy: e.screenY, x: pip.screenX, y: pip.screenY, w: pip.innerWidth, h: pip.innerHeight };
    this.root.setPointerCapture(e.pointerId);
    this.root.classList.add(edge ? "bl-resizing" : "bl-dragging");
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const d = this.drag;
    const pip = this.pip;
    if (!d || !pip) return;
    const dx = e.screenX - d.sx;
    const dy = e.screenY - d.sy;
    try {
      if (d.kind === "move") {
        pip.moveTo(d.x + dx, d.y + dy);
        return;
      }
      let { x, y, w, h } = d;
      if (d.kind.includes("e")) w = Math.max(POPOUT_MIN.width, d.w + dx);
      if (d.kind.includes("s")) h = Math.max(POPOUT_MIN.height, d.h + dy);
      if (d.kind.includes("w")) {
        w = Math.max(POPOUT_MIN.width, d.w - dx);
        x = d.x + d.w - w;
      }
      if (d.kind.includes("n")) {
        h = Math.max(POPOUT_MIN.height, d.h - dy);
        y = d.y + d.h - h;
      }
      // Chromium lets a pop-out resize once per click, so preview the size and apply on release.
      d.target = { x, y, w, h };
      this.toast.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      this.toast.classList.add("bl-toast-on");
    } catch {
      // Chromium wants a recent press for move/resize; the next press starts again.
      this.drag = null;
    }
  };

  private onPointerUp = (): void => {
    const d = this.drag;
    const pip = this.pip;
    if (!d) return;
    this.drag = null;
    this.root.classList.remove("bl-dragging", "bl-resizing");
    if (d.target && pip) {
      this.toast.classList.remove("bl-toast-on");
      try {
        // resizeTo takes the outer size; keep the chrome difference.
        pip.resizeTo(d.target.w + (pip.outerWidth - pip.innerWidth), d.target.h + (pip.outerHeight - pip.innerHeight));
        if (d.target.x !== d.x || d.target.y !== d.y) pip.moveTo(d.target.x, d.target.y);
      } catch {
        // Ignored; the window keeps its size.
      }
    }
    setTimeout(() => this.savePopoutBounds(), 120);
  };

  private savePopoutBounds(): void {
    const pip = this.pip;
    if (!pip) return;
    try {
      Spicetify.LocalStorage.set(POPOUT_KEY, JSON.stringify({ x: pip.screenX, y: pip.screenY, w: pip.innerWidth, h: pip.innerHeight }));
    } catch {
      // Not critical.
    }
  }

  private loadPopoutBounds(): { x: number; y: number; w: number; h: number } | null {
    try {
      const b = JSON.parse(Spicetify.LocalStorage.get(POPOUT_KEY) ?? "null");
      if (b && [b.x, b.y, b.w, b.h].every((n: unknown) => Number.isFinite(n)) && b.w >= POPOUT_MIN.width && b.h >= POPOUT_MIN.height) return b;
    } catch {
      // Fall through to defaults.
    }
    return null;
  }

  private paintVolume(v: number): void {
    if (this.root.ownerDocument.activeElement !== this.volume) this.volume.value = String(Math.round(v * 1000));
    this.paintRange(this.volume);
    const muted = v <= 0.001;
    this.muteBtn.innerHTML = muted ? ICONS.muted : ICONS.volume;
    this.muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
  }

  private paintRange(input: HTMLInputElement): void {
    input.style.setProperty("--bl-fill", `${Number(input.value) / 10}%`);
  }

  private paintSeek(positionMs: number): void {
    const duration = Spicetify.Player.getDuration();
    this.durationEl.textContent = formatTime(duration);
    if (this.seeking) return;
    this.elapsedEl.textContent = formatTime(positionMs);
    this.seek.value = String(duration > 0 ? Math.round((positionMs / duration) * 1000) : 0);
    this.paintRange(this.seek);
  }

  private async onSongChange(): Promise<void> {
    this.onPlayPause();
    const current = currentTrack();
    if (!current || current.track.uri === this.trackUri) return;
    const { track, raw } = current;
    this.trackUri = track.uri;
    const token = ++this.loadToken;

    this.titleEl.textContent = track.title;
    this.artistEl.textContent = track.artist;
    this.miniTitle.textContent = track.title;
    this.miniArtist.textContent = track.artist;
    this.artUrl = artUrlFor(raw);
    for (const img of [this.artEl, this.miniArt]) {
      if (this.artUrl) img.src = this.artUrl;
      else img.removeAttribute("src");
    }
    this.stage.setArt(this.artUrl);
    this.paintBgButton();
    this.lyrics = null;
    this.beats = [];
    this.stage.setLyrics(null);
    this.stage.setBeats([]);
    this.statusEl.textContent = "Finding lyrics";
    this.renderView();

    const [result, beats, sampled] = await Promise.all([
      loadLyrics(track),
      loadBeats(track),
      this.artUrl ? sampleArt(this.artUrl) : Promise.resolve(null),
    ]);
    if (token !== this.loadToken) return;

    this.lyrics = result.lyrics;
    this.beats = beats;
    this.palette = sampled ?? (result.fallbackColor ? { primary: result.fallbackColor, secondary: mix(result.fallbackColor, "#ffffff", 0.45) } : FALLBACK_PALETTE);
    this.stage.setPalette(this.palette);
    this.root.style.setProperty("--bl-accent", this.palette.primary);
    this.stage.setBeats(beats);
    this.stage.setLyrics(this.lyrics?.kind === "synced" ? this.lyrics : null);
    this.statusEl.textContent = this.lyrics ? "" : "No lyrics found for this track";
    this.renderPlain();
    this.renderView();
    this.pushAll();
  }

  private renderPlain(): void {
    this.plain.replaceChildren();
    if (this.lyrics?.kind !== "unsynced") return;
    for (const text of this.lyrics.text) {
      const p = document.createElement("p");
      p.textContent = text;
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

  private pushAll(): void {
    if (!this.companion.connected) return;
    const current = currentTrack();
    if (current) {
      this.companion.send({ type: "track", title: current.track.title, artist: current.track.artist, durationMs: current.track.durationMs, artUrl: this.artUrl?.startsWith("https://i.scdn.co/image/") ? this.artUrl : null, beats: this.beats });
    }
    this.companion.send({ type: "theme", palette: this.palette });
    this.companion.send({ type: "settings", settings: this.settings });
    this.companion.send({ type: "lyrics", lyrics: this.lyrics?.kind === "synced" ? this.lyrics : null });
    this.companion.send({ type: "clock", positionMs: this.clock.position(), playing: this.clock.isPlaying() });
  }

  private wake(): void {
    this.root.classList.remove("bl-idle");
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.root.querySelector(".bl-chrome:hover, .bl-scrim")) this.root.classList.add("bl-idle");
      else this.wake();
    }, IDLE_MS);
  }

  private tick = (): void => {
    if (!this.isOpen) return;
    const position = this.previewMs ?? this.clock.position();
    this.stage.update(position);
    const now = performance.now();
    if (now - this.lastSeekUi > SEEK_UI_MS) {
      this.lastSeekUi = now;
      this.paintSeek(position);
    }
    this.frame = this.frameView.requestAnimationFrame(this.tick);
  };

  private startLoop(): void {
    this.frameView.cancelAnimationFrame(this.frame);
    // A pop-out keeps animating even when the main Spotify window is minimised.
    this.frameView = this.root.ownerDocument.defaultView ?? window;
    this.frame = this.frameView.requestAnimationFrame(this.tick);
  }

  private toggle(): void {
    if (this.isOpen) this.close();
    else void this.open();
  }

  private switchMode(mode: DisplayId): void {
    // The companion window has no size or monitor limits, so prefer it for "pop out".
    if (mode === "window" && this.companion.connected) {
      this.companion.send({ type: "open" });
      this.showToast("Opened in the Bountiful Lyrics window. Drag it to any monitor, any size.");
      return;
    }
    if (mode !== this.settings.display) this.updateSettings({ display: mode });
    if (this.mode !== mode) void this.open(mode);
  }

  /** Moves the single overlay into the requested place. The stage and its state come along. */
  private async open(mode: DisplayId = this.settings.display): Promise<void> {
    if (this.isOpen && this.mode === mode) return;
    if (this.isOpen) this.detach();
    if (mode === "window" && !(await this.attachWindow())) mode = "page";
    if (mode === "page" && !this.attachPage()) mode = "fullscreen";
    if (mode === "fullscreen") this.attachFullscreen();
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.paintBgButton();
    for (const [id, button] of Object.entries(this.modeBtns)) button.setAttribute("aria-pressed", String(id === mode));
    this.isOpen = true;
    this.root.hidden = false;
    this.syncClock(true);
    this.renderView();
    this.paintVolume(Spicetify.Player.getVolume());
    this.wake();
    this.startLoop();
  }

  private attachPage(): boolean {
    const host = document.querySelector(".main-view-container")?.parentElement;
    if (!host) return false;
    host.appendChild(this.root);
    return true;
  }

  private attachFullscreen(): void {
    document.body.appendChild(this.root);
    this.root.requestFullscreen?.().catch(() => {
      // The window still fills Spotify; OS fullscreen is a bonus.
    });
  }

  private async attachWindow(): Promise<boolean> {
    const api = window.documentPictureInPicture;
    if (!api) return false;
    try {
      const saved = this.loadPopoutBounds();
      const pip = api.window ?? (await api.requestWindow(saved ? { width: saved.w, height: saved.h } : POPOUT_DEFAULT));
      if (saved) {
        try {
          pip.moveTo(saved.x, saved.y);
        } catch {
          // Position is a nicety.
        }
      }
      pip.document.title = "Bountiful Lyrics";
      const css = pip.document.createElement("style");
      css.textContent = this.css.textContent;
      pip.document.head.appendChild(css);
      pip.document.body.className = "bl-pip-body";
      pip.document.body.appendChild(this.root);
      pip.document.addEventListener("keydown", this.onKey);
      pip.addEventListener("pagehide", () => {
        if (this.pip !== pip) return;
        this.pip = null;
        // The user closed the pop-out: bring the overlay home and stop.
        document.body.appendChild(this.root);
        this.close();
      });
      pip.addEventListener("resize", () => {
        if (!this.drag) this.savePopoutBounds();
      });
      this.pip = pip;
      if (!saved) setTimeout(() => this.showToast("Spotify limits this pop-out to half your screen and one monitor. Run the companion app for a full-size window."), 400);
      return true;
    } catch {
      return false;
    }
  }

  private detach(): void {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    const pip = this.pip;
    this.pip = null;
    document.body.appendChild(this.root);
    pip?.close();
  }

  private close(): void {
    this.isOpen = false;
    this.frameView.cancelAnimationFrame(this.frame);
    this.detach();
    this.mode = null;
    this.root.hidden = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }
}

(async function boot() {
  const ready = () => typeof Spicetify !== "undefined" && Spicetify.Player && Spicetify.Platform && Spicetify.LocalStorage && Spicetify.Topbar?.Button;
  while (!ready()) await new Promise((r) => setTimeout(r, 200));
  // Give CosmosAsync (Spotify's own lyrics) a moment, but never block on it.
  for (let i = 0; i < 25 && !Spicetify.CosmosAsync; i++) await new Promise((r) => setTimeout(r, 200));
  new App();
})();

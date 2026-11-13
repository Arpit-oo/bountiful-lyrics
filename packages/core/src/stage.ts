import { complement, FALLBACK_PALETTE, isNeutral, mix, type Palette } from "./color";
import { FONT_STACKS } from "./fonts";
import { Glow } from "./glow";
import type { SyncedLyrics } from "./lyrics/model";
import type { BackgroundId, Settings } from "./settings";
import { NightSky } from "./sky";
import { CodestyleRenderer } from "./styles/codestyle";
import { ConstellationRenderer } from "./styles/constellation";
import { FisheyeRenderer } from "./styles/fisheye";
import { GardenRenderer } from "./styles/garden";
import { el, reducedMotion, type Renderer } from "./styles/types";

export interface StageLayers {
  lyrics: boolean;
  glow: boolean;
  /** Transparent stages let the desktop show through (companion overlay). */
  transparent: boolean;
}

const RENDERERS = { codestyle: CodestyleRenderer, constellation: ConstellationRenderer, fisheye: FisheyeRenderer, garden: GardenRenderer };

type ResolvedBackground = Exclude<BackgroundId, "auto"> | "none";

/** "auto" gives each style the backdrop it was designed against. */
export function resolveBackground(settings: Pick<Settings, "background" | "style">, transparent: boolean): ResolvedBackground {
  if (transparent) return "none";
  if (settings.background !== "auto") return settings.background;
  if (settings.style === "garden") return "gradient";
  return settings.style === "constellation" ? "black" : "ambient";
}

/** The shared visual surface: backdrop, lyrics and glow. Used by every target. */
export class Stage {
  readonly el: HTMLElement;
  private readonly bg: HTMLElement;
  private readonly backdrop: HTMLImageElement;
  private readonly ambient: HTMLCanvasElement[];
  private sky: NightSky | null = null;
  private readonly lyricsHost: HTMLElement;
  private readonly glow: Glow;
  private readonly pulseEl: HTMLElement;
  private renderer: Renderer | null = null;
  private rendererStyle: Settings["style"] | null = null;
  private lyrics: SyncedLyrics | null = null;
  private palette: Palette = FALLBACK_PALETTE;
  private background: ResolvedBackground = "none";
  private artUrl: string | null = null;
  private artToken = 0;

  constructor(host: HTMLElement, private settings: Settings, private readonly layers: StageLayers) {
    this.el = el("div", "bl-stage", host);
    this.el.classList.toggle("bl-transparent", layers.transparent);
    this.bg = el("div", "bl-bg", this.el);
    this.backdrop = el("img", "bl-backdrop", this.bg);
    this.backdrop.alt = "";
    this.backdrop.addEventListener("load", () => (this.backdrop.dataset.ready = "1"));
    this.ambient = [el("canvas", "bl-ambient", this.bg), el("canvas", "bl-ambient bl-ambient-b", this.bg)];
    el("div", "bl-bg-gradient", this.bg);
    el("div", "bl-bg-grain", this.bg);
    el("div", "bl-bg-glass", this.bg);
    el("div", "bl-bg-shade", this.bg);
    this.pulseEl = el("div", "bl-bg-pulse", this.bg);
    this.lyricsHost = el("div", "bl-lyrics", this.el);
    this.lyricsHost.hidden = !layers.lyrics;
    this.glow = new Glow(this.el);
    // A soft brightness lift on the beat, so the backdrop breathes with the bass.
    this.glow.onBeat = (strong) => {
      if (this.background === "none" || reducedMotion()) return;
      this.pulseEl.animate([{ opacity: strong ? 0.5 : 0.28 }, { opacity: 0 }], { duration: strong ? 700 : 480, easing: "cubic-bezier(.2,.7,.3,1)" });
    };
    this.applySettings(settings);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    this.el.style.setProperty("--bl-font", FONT_STACKS[settings.font]);
    // Garden keeps its serif unless a different face is picked.
    this.el.style.setProperty("--bl-garden-font", settings.font === "jakarta" ? FONT_STACKS.serif : FONT_STACKS[settings.font]);
    this.el.style.setProperty("--bl-scale", String(settings.textScale));
    this.el.style.setProperty("--bl-star-scale", String(settings.starScale));
    this.el.style.setProperty("--bl-star-text", String(settings.starTextScale));
    this.el.style.setProperty("--bl-tilt", String(settings.tilt));
    this.el.dataset.tilt = settings.tilt > 0 ? "1" : "0";
    if (this.rendererStyle !== settings.style) this.mountRenderer();
    this.setBackground(resolveBackground(settings, this.layers.transparent));
    this.applyColors();
  }

  private setBackground(mode: ResolvedBackground): void {
    if (mode === this.background) return;
    this.background = mode;
    this.el.dataset.bg = mode;
    if (mode === "sky") {
      this.sky ??= new NightSky(this.bg);
      this.sky.setTint(this.palette.primary);
    } else {
      this.sky?.destroy();
      this.sky = null;
    }
  }

  setPalette(palette: Palette): void {
    this.palette = palette;
    this.sky?.setTint(palette.primary);
    this.applyColors();
  }

  private applyColors(): void {
    const { primary, secondary } = this.palette;
    const s = this.settings;
    const onImage = ["art", "ambient", "cinematic", "gradient", "grain"].includes(this.background);
    const lyric = s.manualColors ? s.lyricColor : onImage ? "#ffffff" : this.background === "sky" ? "#f7f8ff" : mix(primary, "#ffffff", 0.55);
    const highlight = s.manualColors ? s.highlightColor : onImage || this.background === "sky" ? mix(primary, "#ffffff", 0.3) : mix(primary, "#ffffff", 0.12);
    const dim = s.manualColors ? s.secondaryColor : onImage ? "rgba(255,255,255,.66)" : this.background === "sky" ? mix(primary, "#c3c9e6", 0.6) : mix(primary, "#8a90a8", 0.55);
    this.el.style.setProperty("--bl-lyric", lyric);
    this.el.style.setProperty("--bl-highlight", highlight);
    this.el.style.setProperty("--bl-secondary", dim);
    this.el.style.setProperty("--bl-ink", mix(highlight, "#000000", 0.78));
    // Garden: roses take the album colour, vines its complement. Greyscale art gets rose noir.
    const neutral = isNeutral(this.palette) && !s.manualColors;
    const rose = neutral ? "#e8141f" : s.manualColors ? s.highlightColor : primary;
    this.el.style.setProperty("--bl-rose", rose);
    // Swirls read as lighter lines on deep roses and darker lines on bright ones.
    const n = Number.parseInt(rose.slice(1), 16);
    const light = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
    this.el.style.setProperty("--bl-rose-line", light ? mix(rose, "#3a1a00", 0.55) : mix(rose, "#fff3e0", 0.55));
    const vine = neutral ? "#2f45ff" : complement(rose);
    this.el.style.setProperty("--bl-vine", vine);
    // Atmospheric gradient and grain take deep versions of the album colours.
    this.el.style.setProperty("--bl-grad-a", mix(rose, "#000000", 0.6));
    this.el.style.setProperty("--bl-grad-b", mix(vine, "#000000", 0.68));
    this.el.style.setProperty("--bl-grad-c", mix(secondary, "#000000", 0.82));
    this.el.style.setProperty("--bl-grain-base", mix(primary, "#0e0d0c", 0.8));
    this.el.style.setProperty("--bl-pulse", mix(primary, "#ffffff", 0.2));
    if (this.layers.glow) this.glow.apply(s, primary, secondary);
    else this.glow.el.hidden = true;
  }

  private mountRenderer(): void {
    this.renderer?.destroy();
    this.rendererStyle = this.settings.style;
    this.el.dataset.style = this.settings.style;
    this.renderer = new RENDERERS[this.settings.style](this.lyricsHost);
    if (this.lyrics) this.renderer.setLyrics(this.lyrics);
  }

  setLyrics(lyrics: SyncedLyrics | null): void {
    this.lyrics = lyrics;
    this.lyricsHost.style.visibility = lyrics ? "" : "hidden";
    if (lyrics) this.renderer?.setLyrics(lyrics);
  }

  setArt(url: string | null): void {
    if (url === this.artUrl) return;
    this.artUrl = url;
    delete this.backdrop.dataset.ready;
    delete this.bg.dataset.ambient;
    if (url) this.backdrop.src = url;
    else this.backdrop.removeAttribute("src");
    if (url) void this.paintAmbient(url);
  }

  /** Ambient light: the art shrunk and blurred into a few colour blobs, drawn once per track. */
  private async paintAmbient(url: string): Promise<void> {
    const token = ++this.artToken;
    const img = new (this.el.ownerDocument.defaultView ?? window).Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    try {
      await img.decode();
    } catch {
      return;
    }
    if (token !== this.artToken) return;
    this.ambient.forEach((canvas, i) => {
      canvas.width = 96;
      canvas.height = 54;
      const g = canvas.getContext("2d");
      if (!g) return;
      g.filter = "blur(6px) saturate(1.45) brightness(.5)";
      g.save();
      if (i === 1) {
        g.translate(96, 54);
        g.rotate(Math.PI);
      }
      g.drawImage(img, -12, -24, 120, 102);
      g.restore();
    });
    this.bg.dataset.ambient = "1";
  }

  setBeats(beatsMs: number[]): void {
    this.glow.setBeats(beatsMs);
    if (this.layers.glow) this.glow.useFallback(this.settings);
  }

  update(positionMs: number): void {
    // Only the words shift; the glow stays locked to the real beat.
    if (this.lyrics && this.layers.lyrics) this.renderer?.update(positionMs + this.settings.lyricsOffsetMs);
    this.glow.update(positionMs);
    this.sky?.draw(performance.now(), reducedMotion());
  }

  destroy(): void {
    this.renderer?.destroy();
    this.glow.destroy();
    this.sky?.destroy();
    this.el.remove();
  }
}

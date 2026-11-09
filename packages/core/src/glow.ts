import { mix } from "./color";
import type { Settings } from "./settings";
import { el, reducedMotion } from "./styles/types";

const FADE_MS = 6000;
const BREATHE_MS = 3600;
const BEAT_MS = 280;
const SPOT_MS = [27000, 35000];
/** Which edges light on successive beats: the light walks around the frame like the reference. */
const EDGE_ORDER: Array<Array<"top" | "right" | "bottom" | "left">> = [["bottom", "right"], ["right"], ["top", "right"], ["top"], ["left", "top"], ["left"], ["bottom", "left"], ["bottom"]];
const SWEEP_MS = 620;
const FLASH_MS = 560;
/** Without beat data, still pulse gently at a calm tempo. */
const FALLBACK_BEAT_MS = 1400;

/**
 * Screen-edge light. Three stacked layers (crisp line, tight bloom, wide haze) give the edge a
 * real light falloff, and two soft hotspots travel around the frame so the light feels alive.
 * All motion is opacity or transform on pre-rendered layers, so the compositor does the work.
 */
export class Glow {
  readonly el: HTMLElement;
  private readonly layerA: HTMLElement;
  private readonly layerB: HTMLElement;
  private readonly spots: HTMLElement[];
  private readonly edges: Record<"top" | "right" | "bottom" | "left", { el: HTMLElement; line: HTMLElement; comet: HTMLElement }>;
  private beatCount = 0;
  private readonly orbit: HTMLElement[];
  private orbitAngle = 0;
  private orbitRun: Animation[] = [];
  /** Called on every beat pulse (true on the downbeat). */
  onBeat: ((strong: boolean) => void) | null = null;
  private lastFallback = 0;
  private beats: number[] = [];
  private beatCursor = 0;
  private lastPosition = 0;
  private mode: Settings["glowAnimation"] = "none";
  private running: Animation[] = [];
  private spotRuns: Animation[] = [];
  private size = { w: 0, h: 0 };
  private readonly resize: ResizeObserver;

  constructor(parent: HTMLElement) {
    this.el = el("div", "bl-glow", parent);
    this.spots = [el("div", "bl-glow-spot", this.el), el("div", "bl-glow-spot bl-glow-spot-b", this.el)];
    this.layerA = this.makeLayer();
    this.layerB = this.makeLayer();
    const edge = (side: "top" | "right" | "bottom" | "left") => {
      const holder = el("div", `bl-edge bl-edge-${side}`, this.el);
      return { el: holder, line: el("div", "bl-edge-line", holder), comet: el("div", "bl-edge-comet", holder) };
    };
    this.edges = { top: edge("top"), right: edge("right"), bottom: edge("bottom"), left: edge("left") };
    // Orbit: half the frame lit, stepping around the edge with each beat.
    this.orbit = ["bl-orbit bl-orbit-bloom", "bl-orbit"].map((cls) => {
      const ring = el("div", cls, this.el);
      return el("div", "bl-orbit-spin", ring);
    });
    this.resize = new ResizeObserver(() => this.runSpots());
    this.resize.observe(this.el);
  }

  private makeLayer(): HTMLElement {
    const layer = el("div", "bl-glow-layer", this.el);
    el("div", "bl-glow-haze", layer);
    el("div", "bl-glow-bloom", layer);
    el("div", "bl-glow-ring", layer);
    return layer;
  }

  setBeats(beatsMs: number[]): void {
    this.beats = beatsMs;
    this.beatCursor = 0;
  }

  apply(settings: Settings, primary: string, secondary: string): void {
    const a = settings.glowOverride ? settings.glowPrimary : primary;
    const b = settings.glowColors === 1 ? a : settings.glowOverride ? settings.glowSecondary : secondary;
    this.el.hidden = !settings.glowEnabled;
    this.el.style.setProperty("--bl-glow-w", `${settings.glowThickness}px`);
    this.el.style.setProperty("--bl-glow-blur", `${settings.glowStrength}px`);
    this.el.style.setProperty("--bl-glow-a", a);
    this.el.style.setProperty("--bl-glow-b", b);
    this.el.style.setProperty("--bl-glow-light", settings.glowLightAuto ? mix(a, "#ffffff", 0.5) : settings.glowLight);
    this.layerA.style.setProperty("--bl-g1", a);
    this.layerA.style.setProperty("--bl-g2", b);
    this.layerB.style.setProperty("--bl-g1", b);
    this.layerB.style.setProperty("--bl-g2", a);
    const nextMode = reducedMotion() ? "none" : settings.glowAnimation;
    if (nextMode !== this.mode || this.running.length === 0) this.startMode(nextMode);
  }

  /** Hotspots ride the perimeter. Keyframes are in pixels, so they are rebuilt on resize. */
  private runSpots(): void {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (w === 0 || h === 0 || (w === this.size.w && h === this.size.h)) return;
    this.size = { w, h };
    this.spotRuns.forEach((a) => a.cancel());
    this.spotRuns = [];
    const s = Math.min(w, h) * 0.46;
    this.spots.forEach((spot) => {
      spot.style.width = spot.style.height = `${s}px`;
    });
    if (reducedMotion() || this.mode === "none") {
      this.spots[0]!.style.transform = `translate(${w * 0.2 - s / 2}px, ${-s / 2}px)`;
      this.spots[1]!.style.transform = `translate(${w * 0.8 - s / 2}px, ${h - s / 2}px)`;
      return;
    }
    const p = 2 * (w + h);
    const at = (x: number, y: number, offset: number) => ({ transform: `translate(${x - s / 2}px, ${y - s / 2}px)`, offset });
    const frames = [at(0, 0, 0), at(w, 0, w / p), at(w, h, (w + h) / p), at(0, h, (2 * w + h) / p), at(0, 0, 1)];
    this.spots.forEach((spot, i) => {
      const duration = SPOT_MS[i]!;
      const run = spot.animate(frames, { duration, iterations: Infinity, easing: "linear", direction: i === 1 ? "reverse" : "normal" });
      run.currentTime = i * duration * 0.5;
      this.spotRuns.push(run);
    });
  }

  private startMode(mode: Settings["glowAnimation"]): void {
    this.running.forEach((a) => a.cancel());
    this.running = [];
    this.mode = mode;
    // Music Sync uses travelling edge light over a dim frame; other modes use the full ring.
    this.el.dataset.mode = mode;
    // Music Sync and Orbit keep the full ring dim so the moving light stands out.
    this.layerA.style.opacity = mode === "music" || mode === "orbit" ? "0.24" : "1";
    this.layerB.style.opacity = "0";
    this.size = { w: 0, h: 0 };
    this.runSpots();
    this.orbitRun.forEach((r) => r.cancel());
    this.orbitRun = [];
    if (mode === "orbit") this.stepOrbit(0, true);
    if (mode === "idle") {
      this.layerB.style.opacity = "";
      this.running.push(this.layerB.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, iterations: Infinity, direction: "alternate", easing: "ease-in-out" }));
    } else if (mode === "default") {
      this.layerA.style.opacity = "";
      this.running.push(this.layerA.animate([{ opacity: 0.68 }, { opacity: 1 }], { duration: BREATHE_MS, iterations: Infinity, direction: "alternate", easing: "ease-in-out" }));
    }
  }

  /** Only Music Sync needs per-frame time. Falls back to Idle when a track has no beats. */
  update(positionMs: number): void {
    if (this.mode !== "music" && this.mode !== "orbit") return;
    if (this.beats.length === 0) {
      const now = performance.now();
      if (now - this.lastFallback > FALLBACK_BEAT_MS) {
        this.lastFallback = now;
        this.beat(false);
      }
      return;
    }
    if (positionMs < this.lastPosition - 500) this.beatCursor = 0;
    this.lastPosition = positionMs;
    while (this.beatCursor < this.beats.length && this.beats[this.beatCursor]! < positionMs - 80) this.beatCursor++;
    const beat = this.beats[this.beatCursor];
    if (beat !== undefined && Math.abs(beat - positionMs) <= 40) {
      this.beatCursor++;
      this.beat(true);
    }
  }

  private beat(strong: boolean): void {
    if (this.mode === "orbit") {
      const n = this.beatCount++;
      this.onBeat?.(strong && n % 4 === 0);
      this.stepOrbit(strong && n % 4 === 0 ? 90 : 45, false);
    } else {
      this.pulse(strong);
    }
  }

  /** Glides the lit half of the frame forward; bigger step on the downbeat. */
  private stepOrbit(degrees: number, reset: boolean): void {
    if (reset) this.orbitAngle = 0;
    const from = this.orbitAngle;
    this.orbitAngle = (this.orbitAngle + degrees) % 3600;
    const to = from + degrees;
    // Settle the previous step so finished animations do not pile up.
    this.orbitRun.forEach((r) => r.cancel());
    this.orbitRun = [];
    for (const spin of this.orbit) {
      spin.style.transform = `rotate(${to}deg)`;
      if (degrees === 0 || reducedMotion()) continue;
      this.orbitRun.push(spin.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], { duration: degrees > 45 ? 520 : 380, easing: "cubic-bezier(.16,1,.3,1)" }));
    }
  }

  /** One beat: light walks to the next edges, sweeping along them, and every fourth beat the whole frame flashes. */
  private pulse(strong: boolean): void {
    const n = this.beatCount++;
    this.onBeat?.(strong && n % 4 === 0);
    const sides = n % 4 === 0 && strong ? (["top", "right", "bottom", "left"] as const) : EDGE_ORDER[Math.floor(n / 1) % EDGE_ORDER.length]!;
    for (const side of sides) {
      const e = this.edges[side];
      e.line.animate([{ opacity: 1 }, { opacity: 0.22 }], { duration: FLASH_MS, easing: "cubic-bezier(.2,.7,.3,1)" });
      // Sweep clockwise: along +x on top, +y on right, -x on bottom, -y on left.
      const horizontal = side === "top" || side === "bottom";
      const forward = side === "top" || side === "right";
      const from = forward ? "-60%" : "160%";
      const to = forward ? "160%" : "-60%";
      e.comet.animate(
        [
          { transform: horizontal ? `translateX(${from})` : `translateY(${from})`, opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { transform: horizontal ? `translateX(${to})` : `translateY(${to})`, opacity: 0 },
        ],
        { duration: SWEEP_MS, easing: "cubic-bezier(.3,.6,.4,1)" },
      );
    }
    this.layerA.animate([{ opacity: 0.55 }, { opacity: 0.28 }], { duration: BEAT_MS * 1.6, easing: "ease-out" });
  }

  /** Kept for callers; beat-less tracks are handled inside update(). */
  useFallback(_settings: Settings): void {
    // Music Sync pulses at a calm fallback tempo when a track has no beat data.
  }

  destroy(): void {
    this.resize.disconnect();
    this.running.forEach((a) => a.cancel());
    this.spotRuns.forEach((a) => a.cancel());
    this.el.remove();
  }
}

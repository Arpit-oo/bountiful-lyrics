import { mix } from "./color";
import { rng } from "./styles/types";

/** Real skies turn 15°/hour. This is sped up enough to feel alive but stay calm. */
export const SKY_DEG_PER_SEC = 0.12;
/** Where the sky turns around, as a fraction of the stage. Off-centre like a real pole star. */
export const SKY_POLE = { x: 0.64, y: 0.22 } as const;

interface SkyStar {
  r: number;
  a: number;
  size: number;
  alpha: number;
  color: string;
  twinkle: number;
  phase: number;
}

/** Star colours lean toward the album colour, with plenty of white so it still reads as a sky. */
const starTints = (tint: string) => ["#ffffff", "#ffffff", "#f4f6ff", mix(tint, "#ffffff", 0.82), mix(tint, "#ffffff", 0.68), mix(tint, "#ffffff", 0.5)];
const SHOOTING_MIN_MS = 9000;
const SHOOTING_SPREAD_MS = 22000;

/**
 * A night sky on one canvas: deep gradient, a soft milky-way band, ~1.6k stars that slowly turn
 * around an off-screen-ish pole, twinkling bright stars and the odd shooting star.
 * Everything is drawn in one pass per frame; the band is pre-rendered once per size.
 */
export class NightSky {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: SkyStar[] = [];
  private band: HTMLCanvasElement | null = null;
  private sprite: HTMLCanvasElement | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private tint = "#9aa3c0";
  private shooting: { x: number; y: number; vx: number; vy: number; born: number; life: number } | null = null;
  private nextShooting = 0;
  private readonly random = rng(20261109);

  constructor(parent: HTMLElement) {
    this.canvas = parent.ownerDocument.createElement("canvas");
    this.canvas.className = "bl-sky";
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
  }

  setTint(color: string): void {
    if (color === this.tint) return;
    this.tint = color;
    this.band = null;
    if (this.width > 0) this.makeStars();
  }

  private resize(width: number, height: number): void {
    const view = this.canvas.ownerDocument.defaultView ?? window;
    this.dpr = Math.min(2, view.devicePixelRatio || 1);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.makeStars();
    this.band = null;
  }

  private makeStars(): void {
    const px = SKY_POLE.x * this.width;
    const py = SKY_POLE.y * this.height;
    const far = Math.max(Math.hypot(px, py), Math.hypot(this.width - px, py), Math.hypot(px, this.height - py), Math.hypot(this.width - px, this.height - py));
    const area = Math.PI * far * far;
    const count = Math.round(Math.min(3200, (area / (this.width * this.height)) * 680));
    const random = rng(7 + Math.round(this.width) * 31 + Math.round(this.height));
    const tints = starTints(this.tint);
    this.stars = Array.from({ length: count }, () => {
      // Uniform in the disk, so density matches everywhere on screen.
      const r = Math.sqrt(random()) * far;
      // Magnitudes follow a steep curve: lots of dim stars, a few bright ones.
      const m = Math.pow(random(), 4.2);
      return {
        r,
        a: random() * Math.PI * 2,
        size: 0.4 + m * 3.1,
        alpha: 0.18 + Math.pow(random(), 1.6) * 0.55 + m * 0.3,
        color: tints[Math.floor(random() * tints.length)]!,
        twinkle: m > 0.18 ? 0.25 + random() * 0.45 : random() < 0.25 ? 0.2 : 0,
        phase: random() * Math.PI * 2,
      };
    });
  }

  private makeSprite(): HTMLCanvasElement {
    const c = this.canvas.ownerDocument.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.12, "rgba(255,255,255,.85)");
    grad.addColorStop(0.3, "rgba(200,215,255,.22)");
    grad.addColorStop(1, "rgba(160,180,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    // Faint diffraction spikes, what makes bright stars read as stars and not dots.
    g.globalCompositeOperation = "lighter";
    for (const [w, h] of [[64, 1.4], [1.4, 64]] as const) {
      const s = g.createLinearGradient(32 - w / 2, 32 - h / 2, 32 + w / 2, 32 + h / 2);
      s.addColorStop(0, "rgba(255,255,255,0)");
      s.addColorStop(0.5, "rgba(255,255,255,.55)");
      s.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = s;
      g.fillRect(32 - w / 2, 32 - h / 2, w, h);
    }
    return c;
  }

  /** The milky way: a long soft diagonal band of haze, dust lanes and tiny packed stars. */
  private makeBand(): HTMLCanvasElement {
    const w = 640;
    const h = Math.max(240, Math.round((640 * this.height) / Math.max(1, this.width)));
    const c = this.canvas.ownerDocument.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const random = rng(99);
    g.translate(w / 2, h / 2);
    g.rotate(-0.42);
    const len = Math.hypot(w, h);
    const haze = mix(this.tint, "#ffffff", 0.35);
    for (let i = 0; i < 110; i++) {
      const x = (random() - 0.5) * len;
      const y = (random() - 0.5) * h * 0.2 + Math.sin(x / 90) * 10;
      const r = 24 + random() * 60;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.015 + random() * 0.03;
      grad.addColorStop(0, hexA(i % 3 === 0 ? haze : mix(this.tint, "#e6e8f0", 0.7), a));
      grad.addColorStop(1, hexA("#c9d4ff", 0));
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Dust lanes cut through the middle.
    g.globalCompositeOperation = "destination-out";
    // Lanes are long thin smudges along the band, never round holes.
    for (let i = 0; i < 40; i++) {
      const x = (random() - 0.5) * len;
      const y = (random() - 0.5) * h * 0.05 + Math.sin(x / 70) * 6;
      const r = 18 + random() * 34;
      g.save();
      g.translate(x, y);
      g.scale(2.6, 0.32);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, "rgba(0,0,0,.28)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2600; i++) {
      const x = (random() - 0.5) * len;
      const spread = (random() + random() + random() - 1.5) * h * 0.14;
      g.fillStyle = `rgba(230,236,255,${0.06 + random() * 0.26})`;
      g.fillRect(x, spread, random() < 0.9 ? 0.6 : 1.1, random() < 0.9 ? 0.6 : 1.1);
    }
    return c;
  }

  /** Draws one frame. `now` is a monotonic clock in ms. */
  draw(now: number, still = false): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    if (width !== this.width || height !== this.height) this.resize(width, height);
    this.sprite ??= this.makeSprite();
    this.band ??= this.makeBand();
    const g = this.ctx;
    const W = this.width;
    const H = this.height;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mix("#020205", this.tint, 0.03));
    sky.addColorStop(0.55, mix("#05060c", this.tint, 0.07));
    sky.addColorStop(1, mix("#08090f", this.tint, 0.2));
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // Horizon airglow, tinted by the album colour.
    const glow = g.createRadialGradient(W * 0.5, H * 1.25, 0, W * 0.5, H * 1.25, H * 0.95);
    glow.addColorStop(0, hexA(mix(this.tint, "#ffffff", 0.1), 0.32));
    glow.addColorStop(0.5, hexA(this.tint, 0.08));
    glow.addColorStop(1, hexA(this.tint, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    const angle = still ? 0 : ((now / 1000) * SKY_DEG_PER_SEC * Math.PI) / 180;
    const px = SKY_POLE.x * W;
    const py = SKY_POLE.y * H;

    g.save();
    g.translate(px, py);
    g.rotate(angle);
    g.translate(-px, -py);
    g.globalAlpha = 0.75;
    g.drawImage(this.band, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
    g.restore();

    g.globalCompositeOperation = "lighter";
    const t = now / 1000;
    for (const s of this.stars) {
      const a = s.a + angle;
      const x = px + Math.cos(a) * s.r;
      const y = py + Math.sin(a) * s.r;
      if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      const tw = s.twinkle && !still ? 1 - s.twinkle * (0.5 + 0.5 * Math.sin(t * (1.3 + s.phase * 0.6) + s.phase)) : 1;
      const alpha = s.alpha * tw;
      if (s.size > 1.25) {
        const d = s.size * 7;
        g.globalAlpha = Math.min(1, alpha);
        g.drawImage(this.sprite, x - d / 2, y - d / 2, d, d);
      } else {
        g.globalAlpha = Math.min(1, alpha);
        g.fillStyle = s.color;
        g.fillRect(x - s.size / 2, y - s.size / 2, s.size, s.size);
      }
    }
    if (!still) this.drawShooting(g, now, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // Soft vignette so the edges sink into black and the edge glow reads.
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  private drawShooting(g: CanvasRenderingContext2D, now: number, W: number, H: number): void {
    if (this.nextShooting === 0) this.nextShooting = now + 4000 + this.random() * SHOOTING_SPREAD_MS;
    if (!this.shooting && now >= this.nextShooting) {
      const fromLeft = this.random() < 0.5;
      const speed = (0.9 + this.random() * 0.7) * Math.max(W, H);
      const dir = (fromLeft ? 0.35 : Math.PI - 0.35) + (this.random() - 0.5) * 0.5;
      this.shooting = { x: W * (0.15 + this.random() * 0.7), y: H * (0.05 + this.random() * 0.35), vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, born: now, life: 650 + this.random() * 500 };
      this.nextShooting = now + SHOOTING_MIN_MS + this.random() * SHOOTING_SPREAD_MS;
    }
    const s = this.shooting;
    if (!s) return;
    const age = (now - s.born) / s.life;
    if (age >= 1) {
      this.shooting = null;
      return;
    }
    const sec = (now - s.born) / 1000;
    const x = s.x + s.vx * sec;
    const y = s.y + s.vy * sec;
    const tail = 0.11;
    const fade = Math.sin(Math.PI * age);
    const grad = g.createLinearGradient(x, y, x - s.vx * tail, y - s.vy * tail);
    grad.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
    grad.addColorStop(1, "rgba(180,200,255,0)");
    g.globalAlpha = 1;
    g.strokeStyle = grad;
    g.lineWidth = 1.6;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - s.vx * tail, y - s.vy * tail);
    g.stroke();
  }

  destroy(): void {
    this.canvas.remove();
  }
}

function hexA(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

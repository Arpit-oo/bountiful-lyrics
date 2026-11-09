// A self-contained showcase page for recording demos: the real renderers, an original lyric on a
// looping clock, synthetic beats for the glow, and a toolbar to switch styles and backdrops.
import {
  buildSyncedLyrics,
  CORE_CSS,
  DEFAULT_SETTINGS,
  FONT_CSS,
  openSettings,
  OVERLAY_CSS,
  sanitizeSettings,
  Stage,
  type Settings,
} from "@bountiful/core";

// Original words written for this demo, so the video carries no third-party lyrics.
const LINES: Array<[number, string]> = [
  [400, "city lights are fading slow"],
  [3600, "every star is calling home"],
  [6800, "hold the night inside your hands"],
  [10000, "we were made of borrowed time"],
  [13200, "roses bloom where words are sung"],
  [16400, "every heartbeat finds a rhyme"],
  [19600, "turn it up and let it glow"],
  [22800, "moonlight dancing on the road"],
  [26000, "you and me and nowhere else"],
  [29200, "drawing shapes across the sky"],
  [32400, "every word a falling star"],
  [35600, "stay with me until the dawn"],
];
const LOOP_MS = 39000;
const BEAT_MS = 500;

const PALETTES = [
  { primary: "#ff4d6d", secondary: "#ff8a5c" },
  { primary: "#7c6cff", secondary: "#c56bff" },
];

const css = document.createElement("style");
css.textContent = `${FONT_CSS}${CORE_CSS}${OVERLAY_CSS}
html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:"BL Jakarta","Segoe UI",sans-serif;container-type:size}
.bl-overlay{display:block}
.sc-bar{position:fixed;left:50%;bottom:28px;z-index:2147483600;transform:translateX(-50%);display:flex;gap:6px;padding:6px;border-radius:999px;background:rgba(18,18,24,.72);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.sc-bar button{height:38px;padding:0 16px;white-space:nowrap;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.75);font:650 14px "BL Jakarta","Segoe UI",sans-serif;cursor:pointer;transition:background-color .2s ease,color .2s ease}
.sc-bar button:hover{color:#fff;background:rgba(255,255,255,.08)}
.sc-bar button[aria-pressed="true"]{background:#fff;color:#000}
.sc-sep{width:1px;margin:8px 4px;background:rgba(255,255,255,.14)}
.sc-cap{position:fixed;left:56px;top:48px;z-index:2147483600;color:#fff;pointer-events:none;transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.sc-cap b{display:block;font-size:40px;font-weight:800;letter-spacing:-.02em}
.sc-cap span{display:block;margin-top:6px;font-size:18px;color:rgba(255,255,255,.7)}
.sc-cap.sc-hide{opacity:0;transform:translateY(-8px)}
`;
document.head.appendChild(css);

const root = document.createElement("div");
root.className = "bl-overlay";
root.dataset.mode = "fullscreen";
document.body.appendChild(root);

let settings: Settings = sanitizeSettings({ ...DEFAULT_SETTINGS, style: "constellation", background: "auto", glowAnimation: "music", starScale: 1.15, starTextScale: 1.15 });
const stage = new Stage(root, settings, { lyrics: true, glow: true, transparent: false });
const raw = LINES.map(([startMs, text], i) => ({ startMs, endMs: (LINES[i + 1]?.[0] ?? LOOP_MS - 600) - 250, text }));
stage.setLyrics(buildSyncedLyrics(raw, "Bountiful demo", LOOP_MS));
stage.setBeats(Array.from({ length: Math.floor(LOOP_MS / BEAT_MS) }, (_, i) => i * BEAT_MS + 120));

/** A painted "album cover" so the art-based backdrops have colour to work with. */
function paintArt(p: { primary: string; secondary: string }): string {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 512, 512);
  bg.addColorStop(0, p.primary);
  bg.addColorStop(1, "#14102a");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);
  for (const [x, y, r, col] of [[360, 150, 150, p.secondary], [140, 380, 190, "#2a1f6b"], [300, 330, 90, "#ffd27a"]] as const) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "transparent");
    g.fillStyle = rg;
    g.fillRect(0, 0, 512, 512);
  }
  return c.toDataURL("image/png");
}
stage.setPalette(PALETTES[0]!);
stage.setArt(paintArt(PALETTES[0]!));

// Looping clock: the lyric repeats so any recording length works.
const t0 = performance.now();
const tick = () => {
  stage.update((performance.now() - t0) % LOOP_MS);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

const cap = document.createElement("div");
cap.className = "sc-cap sc-hide";
const capTitle = document.createElement("b");
const capSub = document.createElement("span");
cap.append(capTitle, capSub);
document.body.appendChild(cap);
let capTimer: ReturnType<typeof setTimeout> | null = null;
function caption(title: string, sub: string): void {
  capTitle.textContent = title;
  capSub.textContent = sub;
  cap.classList.remove("sc-hide");
  if (capTimer) clearTimeout(capTimer);
  capTimer = setTimeout(() => cap.classList.add("sc-hide"), 3600);
}

function update(patch: Partial<Settings>): void {
  settings = sanitizeSettings({ ...settings, ...patch });
  stage.applySettings(settings);
  stage.setBeats(Array.from({ length: Math.floor(LOOP_MS / BEAT_MS) }, (_, i) => i * BEAT_MS + 120));
  paintPressed();
}

const bar = document.createElement("nav");
bar.className = "sc-bar";
bar.setAttribute("aria-label", "Showcase controls");
document.body.appendChild(bar);
type Item = { label: string; patch: Partial<Settings>; title: string; sub: string; key: keyof Settings };
const groups: Item[][] = [
  [
    { label: "Constellation", key: "style", patch: { style: "constellation", background: "auto" }, title: "Constellation", sub: "Every phrase becomes a star pattern" },
    { label: "Garden", key: "style", patch: { style: "garden", background: "auto" }, title: "Garden", sub: "Roses and vines grow from every word" },
    { label: "Fisheye", key: "style", patch: { style: "fisheye", background: "auto" }, title: "Fisheye", sub: "A rolling 3D word drum" },
    { label: "Codestyle", key: "style", patch: { style: "codestyle", background: "auto" }, title: "Codestyle", sub: "Lyrics typed as code" },
  ],
  [
    { label: "Night sky", key: "background", patch: { background: "sky" }, title: "Night sky", sub: "A slowly turning sky, tinted by the album" },
    { label: "Cinematic", key: "background", patch: { background: "cinematic" }, title: "Cinematic blur", sub: "The cover, blown up and softly blurred" },
    { label: "Grain", key: "background", patch: { background: "grain" }, title: "Film grain", sub: "Warm analog texture" },
  ],
  [
    { label: "Music Sync", key: "glowAnimation", patch: { glowAnimation: "music" }, title: "Music Sync glow", sub: "Light walks the edges on every beat" },
    { label: "Orbit", key: "glowAnimation", patch: { glowAnimation: "orbit" }, title: "Orbit glow", sub: "Half the frame lit, kicking forward with the beat" },
  ],
];
const buttons: Array<{ el: HTMLButtonElement; item: Item }> = [];
groups.forEach((group, gi) => {
  if (gi > 0) bar.append(Object.assign(document.createElement("span"), { className: "sc-sep" }));
  for (const item of group) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = item.label;
    b.addEventListener("click", () => {
      update(item.patch);
      caption(item.title, item.sub);
    });
    bar.append(b);
    buttons.push({ el: b, item });
  }
});
bar.append(Object.assign(document.createElement("span"), { className: "sc-sep" }));
const gear = document.createElement("button");
gear.type = "button";
gear.textContent = "Settings";
gear.addEventListener("click", () => openSettings(root, settings, (patch) => update(patch), null));
bar.append(gear);

function paintPressed(): void {
  for (const { el, item } of buttons) {
    const v = item.patch[item.key];
    el.setAttribute("aria-pressed", String(settings[item.key] === v));
  }
}
paintPressed();
caption("Bountiful Lyrics", "Immersive lyrics for Spotify, YouTube Music and your desktop");

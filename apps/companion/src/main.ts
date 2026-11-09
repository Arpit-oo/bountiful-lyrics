import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CORE_CSS, DEFAULT_SETTINGS, FONT_CSS, openSettings, OVERLAY_CSS, PlaybackClock, sanitizeSettings, Stage, type Settings, type StyleIdOverride } from "./shared";
import { parseMessage, type CompanionMessage } from "@bountiful/protocol";

declare global {
  interface Window {
    __BL_MODE__?: "overlay" | "idle" | "player";
  }
}

interface View {
  showLyrics: boolean;
  style: StyleIdOverride;
}

const mode = window.__BL_MODE__ === "idle" ? "idle" : window.__BL_MODE__ === "player" ? "player" : "overlay";
const framed = mode !== "overlay";
const PAGE_CSS = `
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${framed ? "#000" : "transparent"};container-type:size}
body.bl-no-lyrics .bl-lyrics{display:none}
body{font-family:"BL Jakarta","Segoe UI",sans-serif;color:#f4f1ea}
button,input,select{font:inherit}
:focus-visible{outline:2px solid #fff;outline-offset:2px}
.bl-clock{position:absolute;top:7vh;left:0;right:0;text-align:center;font-family:"BL Jakarta","Segoe UI",sans-serif;color:rgba(255,255,255,.72);pointer-events:none}
.bl-clock-date{font-size:clamp(14px,2vh,22px);font-weight:600}
.bl-clock-time{font-size:clamp(48px,9vh,110px);font-weight:300;line-height:1.1}
.bl-wait{position:absolute;inset:0;display:grid;place-content:center;gap:10px;text-align:center;font-family:"BL Jakarta","Segoe UI",sans-serif;font-size:18px;color:rgba(255,255,255,.6);padding:24px}
.bl-wait small{font-size:14px;color:rgba(255,255,255,.4)}
.bl-now{position:absolute;left:20px;bottom:18px;z-index:4;display:flex;align-items:center;gap:12px;padding:8px 14px 8px 8px;border-radius:14px;background:rgba(0,0,0,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-family:"BL Jakarta","Segoe UI",sans-serif;color:#fff;transition:opacity .4s ease;max-width:60vw}
.bl-now img{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#222}
.bl-now b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-now span{display:block;font-size:12.5px;color:rgba(255,255,255,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-hint-fs{position:absolute;right:18px;bottom:22px;z-index:4;font:600 12px "BL Jakarta","Segoe UI",sans-serif;color:rgba(255,255,255,.5);transition:opacity .4s ease}
body.bl-quiet .bl-chrome{opacity:0;transform:translateY(12px);pointer-events:none}
body.bl-quiet .bl-hint-fs{opacity:0}
.bl-chrome[hidden]{display:none}
body:not(.bl-live) .bl-chrome-center,body:not(.bl-live) .bl-volume{opacity:.35;pointer-events:none}
body.bl-quiet{cursor:none}
.bl-wait[hidden]{display:none}
`;

const style = document.createElement("style");
style.textContent = FONT_CSS + CORE_CSS + (mode === "player" ? OVERLAY_CSS : "") + PAGE_CSS;
document.head.appendChild(style);

let settings: Settings = DEFAULT_SETTINGS;
let view: View = { showLyrics: false, style: null };
let beats: number[] = [];
let connected = false;
let hasLyrics = false;
let frame = 0;

const clock = new PlaybackClock();
const stage = new Stage(document.body, settings, { lyrics: true, glow: true, transparent: mode === "overlay" });

const effective = (): Settings => ({ ...settings, style: view.style ?? settings.style });
const lyricsVisible = () => framed || view.showLyrics;

const wait = document.createElement("div");
wait.className = "bl-wait";
wait.append(Object.assign(document.createElement("div"), { textContent: "Waiting for Spotify" }), Object.assign(document.createElement("small"), { textContent: "Open Spotify with the Bountiful Lyrics plugin. This window fills in by itself." }));
wait.hidden = !framed;
document.body.appendChild(wait);

// Player window: a control bar for Spotify (play, skip, seek, volume, settings) that fades while you watch.
const svg = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${d}"/></svg>`;
const ICONS = {
  back: svg("M6 5h2v14H6zM20 5v14L9 12z"),
  next: svg("M16 5h2v14h-2zM4 5v14l11-7z"),
  play: svg("M7 4v16l13-8z"),
  pause: svg("M6 4h4v16H6zM14 4h4v16h-4z"),
  gear: svg("M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8.5 5-.9-.5a7.6 7.6 0 0 0 0-2l.9-.5a1 1 0 0 0 .4-1.3l-1.6-2.8a1 1 0 0 0-1.3-.4l-1 .5a7.6 7.6 0 0 0-1.7-1V4a1 1 0 0 0-1-1h-3.2a1 1 0 0 0-1 1v1.5a7.6 7.6 0 0 0-1.7 1l-1-.5a1 1 0 0 0-1.3.4L3.5 9.2a1 1 0 0 0 .4 1.3l.9.5a7.6 7.6 0 0 0 0 2l-.9.5a1 1 0 0 0-.4 1.3l1.6 2.8a1 1 0 0 0 1.3.4l1-.5a7.6 7.6 0 0 0 1.7 1V20a1 1 0 0 0 1 1h3.2a1 1 0 0 0 1-1v-1.5a7.6 7.6 0 0 0 1.7-1l1 .5a1 1 0 0 0 1.3-.4l1.6-2.8a1 1 0 0 0-.4-1.3Z"),
  volume: svg("M3 9h4l5-4v14l-5-4H3zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 5.6a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-9.9z"),
  muted: svg("M3 9h4l5-4v14l-5-4H3zM15.3 9.7l1.4-1.4L19 10.6l2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"),
  full: svg("M3 3h7v2H5v5H3zM14 3h7v7h-2V5h-5zM3 14h2v5h5v2H3zM19 14h2v7h-7v-2h5z"),
};
const control = (action: string, value?: unknown) => void invoke("control", { action, value: value ?? null });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement) => {
  const n = document.createElement(tag);
  n.className = cls;
  parent.appendChild(n);
  return n;
};
const button = (cls: string, label: string, icon: string, parent: HTMLElement, onClick: () => void) => {
  const b = el("button", cls, parent);
  b.setAttribute("aria-label", label);
  b.title = label;
  b.innerHTML = icon; // Constant markup only.
  b.addEventListener("click", onClick);
  return b;
};
const slider = (cls: string, label: string, parent: HTMLElement) => {
  const i = el("input", cls, parent);
  i.type = "range";
  i.min = "0";
  i.max = "1000";
  i.setAttribute("aria-label", label);
  return i;
};
const fill = (i: HTMLInputElement) => i.style.setProperty("--bl-fill", `${Number(i.value) / 10}%`);
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

const bar = el("div", "bl-chrome", document.body);
bar.hidden = mode !== "player";
const left = el("div", "bl-chrome-left", bar);
const nowArt = el("img", "bl-mini-art", left);
nowArt.alt = "";
const meta = el("div", "bl-mini-meta", left);
const nowTitle = el("div", "bl-mini-title", meta);
const nowArtist = el("div", "bl-mini-artist", meta);
const center = el("div", "bl-chrome-center", bar);
const transport = el("div", "bl-transport", center);
button("bl-icon-btn", "Previous", ICONS.back, transport, () => control("previous"));
const playBtn = button("bl-icon-btn bl-play", "Play or pause (Space)", ICONS.play, transport, () => control("toggle"));
button("bl-icon-btn", "Next", ICONS.next, transport, () => control("next"));
const seekRow = el("div", "bl-seek-row", center);
const elapsed = el("div", "bl-time", seekRow);
const seek = slider("bl-seek", "Seek", seekRow);
const total = el("div", "bl-time", seekRow);
let durationMs = 0;
let seeking = false;
seek.addEventListener("input", () => {
  seeking = true;
  fill(seek);
  elapsed.textContent = fmt((Number(seek.value) / 1000) * durationMs);
});
seek.addEventListener("change", () => {
  control("seek", Math.round((Number(seek.value) / 1000) * durationMs));
  seeking = false;
});
const right = el("div", "bl-chrome-right", bar);
const volWrap = el("div", "bl-volume", right);
let lastVolume = 0.6;
const muteBtn = button("bl-icon-btn bl-icon-sm", "Mute", ICONS.volume, volWrap, () => {
  const v = Number(volume.value) / 1000;
  if (v > 0.001) lastVolume = v;
  setVolume(v > 0.001 ? 0 : lastVolume || 0.5);
});
const volume = slider("bl-vol", "Volume", volWrap);
volume.addEventListener("input", () => setVolume(Number(volume.value) / 1000));
function setVolume(v: number): void {
  volume.value = String(Math.round(v * 1000));
  fill(volume);
  muteBtn.innerHTML = v <= 0.001 ? ICONS.muted : ICONS.volume;
  control("volume", v);
}
function paintVolume(v: number): void {
  if (document.activeElement === volume) return;
  volume.value = String(Math.round(v * 1000));
  fill(volume);
  muteBtn.innerHTML = v <= 0.001 ? ICONS.muted : ICONS.volume;
}
button("bl-icon-btn bl-icon-sm", "Settings (S)", ICONS.gear, right, () => openPanel());
button("bl-icon-btn bl-icon-sm", "Fullscreen (F11)", ICONS.full, right, () => void toggleFullscreen());
function openPanel(): void {
  if (document.querySelector(".bl-scrim")) return;
  openSettings(document.body, settings, (patch) => {
    settings = sanitizeSettings({ ...settings, ...patch });
    applyAll();
    control("settings", patch);
  }, null);
}
const fsHint = Object.assign(document.createElement("div"), { className: "bl-hint-fs", textContent: "F11 or double-click for fullscreen" });
fsHint.hidden = true;
document.body.appendChild(fsHint);
if (mode === "player") {
  setInterval(() => {
    if (!connected || seeking || durationMs <= 0) return;
    const pos = Math.min(durationMs, clock.position());
    elapsed.textContent = fmt(pos);
    total.textContent = fmt(durationMs);
    seek.value = String(Math.round((pos / durationMs) * 1000));
    fill(seek);
  }, 250);
}
let quietTimer: ReturnType<typeof setTimeout> | null = null;
function wakeUi(): void {
  document.body.classList.remove("bl-quiet");
  if (quietTimer) clearTimeout(quietTimer);
  quietTimer = setTimeout(() => document.body.classList.add("bl-quiet"), 2600);
}
async function toggleFullscreen(force?: boolean): Promise<void> {
  const win = getCurrentWindow();
  const next = force ?? !(await win.isFullscreen());
  await win.setFullscreen(next);
}

function applyAll(): void {
  document.body.classList.toggle("bl-no-lyrics", !lyricsVisible());
  stage.applySettings(effective());
  stage.setBeats(beats);
  schedule();
}

function setConnected(value: boolean): void {
  connected = value;
  stage.el.style.visibility = value || framed ? "" : "hidden";
  if (framed) wait.hidden = value;
  document.body.classList.toggle("bl-live", value);
  schedule();
}

/** A click-through glow with no lyrics needs no per-frame work, so the overlay stays idle. */
function needsFrames(): boolean {
  return connected && ((lyricsVisible() && hasLyrics) || settings.glowAnimation === "music" || settings.glowAnimation === "orbit" || (framed && settings.background === "sky"));
}

function tick(): void {
  frame = 0;
  stage.update(clock.position());
  schedule();
}

function schedule(): void {
  if (needsFrames() && frame === 0) frame = requestAnimationFrame(tick);
  else if (!needsFrames() && frame !== 0) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

function handle(message: CompanionMessage): void {
  if (!connected) setConnected(true);
  switch (message.type) {
    case "track":
      beats = message.beats;
      nowTitle.textContent = message.title;
      nowArtist.textContent = message.artist;
      durationMs = message.durationMs;
      if (message.artUrl) nowArt.src = message.artUrl;
      else nowArt.removeAttribute("src");
      document.title = message.title ? `${message.title} · Bountiful Lyrics` : "Bountiful Lyrics";
      stage.setArt(message.artUrl);
      stage.setBeats(beats);
      break;
    case "lyrics":
      hasLyrics = !!message.lyrics;
      stage.setLyrics(message.lyrics);
      break;
    case "clock":
      clock.sync(message.positionMs, message.playing, !message.playing);
      playBtn.innerHTML = message.playing ? ICONS.pause : ICONS.play;
      playBtn.setAttribute("aria-label", message.playing ? "Pause (Space)" : "Play (Space)");
      if (message.volume !== undefined) paintVolume(message.volume);
      if (!message.playing) stage.update(clock.position());
      break;
    case "theme":
      stage.setPalette(message.palette);
      break;
    case "settings":
      settings = message.settings;
      applyAll();
      break;
    case "hello":
    case "open":
      break;
  }
  schedule();
}

function receive(raw: string): void {
  const message = parseMessage(raw);
  if (message) handle(message);
}

function renderClock(): void {
  const clockEl = document.createElement("div");
  clockEl.className = "bl-clock";
  const date = document.createElement("div");
  date.className = "bl-clock-date";
  const time = document.createElement("div");
  time.className = "bl-clock-time";
  clockEl.append(date, time);
  document.body.appendChild(clockEl);
  const paint = () => {
    const now = new Date();
    date.textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    time.textContent = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };
  paint();
  setInterval(paint, 1000);
}

async function start(): Promise<void> {
  applyAll();
  setConnected(false);
  await listen<string>("frame", (e) => receive(e.payload));
  await listen("disconnected", () => {
    hasLyrics = false;
    stage.setLyrics(null);
    setConnected(false);
  });
  await listen<View>("view", (e) => {
    view = e.payload;
    applyAll();
  });
  view = await invoke<View>("view_state");
  applyAll();
  for (const raw of await invoke<string[]>("snapshot")) receive(raw);
  if (mode === "player") {
    wakeUi();
    document.addEventListener("mousemove", wakeUi);
    document.addEventListener("dblclick", (e) => {
      if (!(e.target as HTMLElement).closest(".bl-chrome,.bl-scrim")) void toggleFullscreen();
    });
    document.addEventListener("keydown", (e) => {
      if (document.querySelector(".bl-scrim") || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "F11" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "Escape") void toggleFullscreen(false);
      else if (e.key === " ") {
        e.preventDefault();
        control("toggle");
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") control("seek", Math.max(0, clock.position() + (e.key === "ArrowRight" ? 5000 : -5000)));
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") setVolume(Math.min(1, Math.max(0, Number(volume.value) / 1000 + (e.key === "ArrowUp" ? 0.05 : -0.05))));
      else if (e.key === "s" || e.key === "S") openPanel();
      else if (e.key === "n" || e.key === "N") control("next");
      else if (e.key === "p" || e.key === "P") control("previous");
      else return;
      wakeUi();
    });
  }
  if (mode === "idle") {
    renderClock();
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") void invoke("close_idle");
    });
  }
}

void start();

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CORE_CSS, DEFAULT_SETTINGS, FONT_CSS, PlaybackClock, Stage, type Settings, type StyleIdOverride } from "./shared";
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
body.bl-quiet .bl-now,body.bl-quiet .bl-hint-fs{opacity:0}
body.bl-quiet{cursor:none}
.bl-wait[hidden]{display:none}
`;

const style = document.createElement("style");
style.textContent = FONT_CSS + CORE_CSS + PAGE_CSS;
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

// Player window: now-playing strip and a fullscreen hint that fade out while you watch.
const now = document.createElement("div");
now.className = "bl-now";
now.hidden = mode !== "player";
const nowArt = document.createElement("img");
nowArt.alt = "";
const nowText = document.createElement("div");
const nowTitle = document.createElement("b");
const nowArtist = document.createElement("span");
nowText.append(nowTitle, nowArtist);
now.append(nowArt, nowText);
document.body.appendChild(now);
const fsHint = Object.assign(document.createElement("div"), { className: "bl-hint-fs", textContent: "F11 or double-click for fullscreen" });
fsHint.hidden = mode !== "player";
document.body.appendChild(fsHint);
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
  now.style.visibility = value ? "" : "hidden";
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
    document.addEventListener("dblclick", () => void toggleFullscreen());
    document.addEventListener("keydown", (e) => {
      if (e.key === "F11" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "Escape") {
        void toggleFullscreen(false);
      }
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

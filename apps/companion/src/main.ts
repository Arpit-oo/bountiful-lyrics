import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CORE_CSS, DEFAULT_SETTINGS, FONT_CSS, PlaybackClock, Stage, type Settings, type StyleIdOverride } from "./shared";
import { parseMessage, type CompanionMessage } from "@bountiful/protocol";

declare global {
  interface Window {
    __BL_MODE__?: "overlay" | "idle";
  }
}

interface View {
  showLyrics: boolean;
  style: StyleIdOverride;
}

const mode = window.__BL_MODE__ === "idle" ? "idle" : "overlay";
const PAGE_CSS = `
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${mode === "idle" ? "#000" : "transparent"}}
body.bl-no-lyrics .bl-lyrics{display:none}
.bl-clock{position:absolute;top:7vh;left:0;right:0;text-align:center;font-family:"BL Jakarta","Segoe UI",sans-serif;color:rgba(255,255,255,.72);pointer-events:none}
.bl-clock-date{font-size:clamp(14px,2vh,22px);font-weight:600}
.bl-clock-time{font-size:clamp(48px,9vh,110px);font-weight:300;line-height:1.1}
.bl-wait{position:absolute;inset:0;display:grid;place-items:center;font-family:"BL Jakarta","Segoe UI",sans-serif;font-size:18px;color:rgba(255,255,255,.5)}
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
const lyricsVisible = () => mode === "idle" || view.showLyrics;

const wait = document.createElement("div");
wait.className = "bl-wait";
wait.textContent = "Waiting for Spotify";
wait.hidden = mode !== "idle";
document.body.appendChild(wait);

function applyAll(): void {
  document.body.classList.toggle("bl-no-lyrics", !lyricsVisible());
  stage.applySettings(effective());
  stage.setBeats(beats);
  schedule();
}

function setConnected(value: boolean): void {
  connected = value;
  stage.el.style.visibility = value || mode === "idle" ? "" : "hidden";
  if (mode === "idle") wait.hidden = value;
  schedule();
}

/** A click-through glow with no lyrics needs no per-frame work, so the overlay stays idle. */
function needsFrames(): boolean {
  return connected && ((lyricsVisible() && hasLyrics) || settings.glowAnimation === "music");
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
  if (mode === "idle") {
    renderClock();
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") void invoke("close_idle");
    });
  }
}

void start();

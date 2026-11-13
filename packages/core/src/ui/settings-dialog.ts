import { FONT_LABELS, FONT_STACKS } from "../fonts";
import { BACKGROUND_IDS, DEFAULT_SETTINGS, DISPLAY_IDS, FONT_IDS, GLOW_ANIMATIONS, STYLE_IDS, type Settings } from "../settings";

const STYLE_INFO: Record<Settings["style"], { name: string; blurb: string; art: string }> = {
  constellation: {
    name: "Constellation",
    blurb: "Each phrase becomes a star pattern",
    art: `<svg viewBox="0 0 120 70"><g stroke="currentColor" stroke-width="1" opacity=".55" fill="none"><path d="M14 46 38 22 62 40 88 18 106 44 70 54Z"/></g><g fill="currentColor"><path d="M38 16c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6Z"/><circle cx="14" cy="46" r="2"/><circle cx="62" cy="40" r="2"/><circle cx="88" cy="18" r="2"/><circle cx="106" cy="44" r="2"/><circle cx="70" cy="54" r="2"/></g><circle cx="38" cy="22" r="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>`,
  },
  garden: {
    name: "Garden",
    blurb: "Roses and vines grow from each word",
    art: `<svg viewBox="0 0 120 70"><text x="60" y="44" font-family="Georgia,serif" font-size="22" text-anchor="middle" fill="currentColor">bloom</text><g fill="#e8141f"><circle cx="34" cy="24" r="7"/><circle cx="62" cy="20" r="9"/><circle cx="86" cy="26" r="6"/><circle cx="74" cy="50" r="5"/></g><g stroke="#2f45ff" stroke-width="1.6" fill="none"><path d="M20 40c-8-2-10-8-6-12M96 36c8 0 10-6 6-10M46 48c2 8-2 12-6 12"/></g></svg>`,
  },
  fisheye: {
    name: "Fisheye",
    blurb: "A rolling 3D drum of words",
    art: `<svg viewBox="0 0 120 70"><text x="60" y="18" font-size="9" text-anchor="middle" fill="currentColor" opacity=".45" font-weight="800">before</text><text x="60" y="42" font-size="22" text-anchor="middle" fill="currentColor" font-weight="800">now</text><rect x="40" y="50" width="40" height="13" rx="2" fill="currentColor" opacity=".9"/><text x="60" y="60" font-size="9" text-anchor="middle" font-weight="800" fill="#000">next</text></svg>`,
  },
  codestyle: {
    name: "Codestyle",
    blurb: "Lyrics typed out as code",
    art: `<svg viewBox="0 0 120 70" font-family="Consolas,monospace" font-weight="700"><text x="60" y="22" font-size="8" text-anchor="middle" fill="currentColor" opacity=".4">i.got.that</text><text x="60" y="34" font-size="9" text-anchor="middle" fill="currentColor" opacity=".7">off(black, cadillac)</text><text x="54" y="50" font-size="11" text-anchor="middle" fill="currentColor">// midnight</text><rect x="92" y="41" width="6" height="11" fill="#ff3b4e"/></svg>`,
  },
};

const BACKGROUND_INFO: Record<Settings["background"], { name: string; swatch: string }> = {
  auto: { name: "Match style", swatch: "conic-gradient(from 200deg,#1b1b2a,#3a1d2b,#13283a,#1b1b2a)" },
  gradient: { name: "Atmospheric", swatch: "radial-gradient(60% 60% at 30% 35%,#5a1220,transparent 70%),radial-gradient(60% 60% at 72% 68%,#122a5a,transparent 70%),#050507" },
  cinematic: { name: "Cinematic blur", swatch: "radial-gradient(70% 70% at 45% 45%,#6b4a3a,#2a1d1a 60%,#060505)" },
  ambient: { name: "Ambient colours", swatch: "radial-gradient(50% 60% at 30% 40%,#3d5a8a,transparent 70%),radial-gradient(50% 60% at 70% 60%,#8a3d6a,transparent 70%),#151520" },
  art: { name: "Frosted art", swatch: "linear-gradient(160deg,rgba(255,255,255,.16),transparent 45%),radial-gradient(70% 70% at 40% 40%,#9a6a4a,#3a2a3a)" },
  grain: { name: "Film grain", swatch: "repeating-radial-gradient(circle at 30% 30%,rgba(255,255,255,.08) 0 1px,transparent 1px 3px),#2a2420" },
  sky: { name: "Night sky", swatch: "radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 60% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 80% 60%,#fff,transparent),radial-gradient(1px 1px at 35% 70%,#fff,transparent),linear-gradient(#05060c,#0d1020)" },
  black: { name: "Black", swatch: "#000" },
};

const DISPLAY_LABELS: Record<Settings["display"], string> = { page: "Inside Spotify", fullscreen: "Fullscreen", window: "Pop-out" };
const GLOW_LABELS: Record<Settings["glowAnimation"], string> = { music: "Music Sync", orbit: "Orbit", default: "Breathe", idle: "Drift", none: "Still" };
const PRESETS = ["#ffffff", "#ff4d5e", "#ff9f43", "#ffd84d", "#5ee08a", "#4dd2ff", "#5b6bff", "#b46bff", "#ff6bd1", "#e8141f", "#2f45ff", "#f4f1ea"];

type Change = (patch: Partial<Settings>) => void;
type Tab = "lyrics" | "look" | "colour" | "glow" | "more";

export interface SettingsOptions {
  /** Show the "Open in" choice. Only the Spotify plugin has display modes. */
  display?: boolean;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function row(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const r = h("div", "bl-field");
  const text = h("div", "bl-field-text");
  text.append(h("span", "bl-field-label", label));
  if (hint) text.append(h("span", "bl-field-hint", hint));
  r.append(text, control);
  return r;
}

function toggle(current: boolean, label: string, onChange: (v: boolean) => void): HTMLButtonElement {
  const b = h("button", "bl-switch");
  b.type = "button";
  b.setAttribute("role", "switch");
  b.setAttribute("aria-checked", String(current));
  b.setAttribute("aria-label", label);
  b.addEventListener("click", () => {
    const next = b.getAttribute("aria-checked") !== "true";
    b.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  return b;
}

function slider(min: number, max: number, step: number, current: number, format: (v: number) => string, label: string, onChange: (v: number) => void): HTMLElement {
  const wrap = h("div", "bl-slider");
  const i = h("input", "bl-range");
  i.type = "range";
  i.min = String(min);
  i.max = String(max);
  i.step = String(step);
  i.value = String(current);
  i.setAttribute("aria-label", label);
  const out = h("output", "bl-slider-value", format(current));
  const paint = () => i.style.setProperty("--bl-fill", `${((Number(i.value) - min) / (max - min)) * 100}%`);
  paint();
  i.addEventListener("input", () => {
    out.textContent = format(Number(i.value));
    paint();
    onChange(Number(i.value));
  });
  wrap.append(i, out);
  return wrap;
}

function segmented<T extends string>(values: readonly T[], labels: Record<T, string>, current: T, label: string, onChange: (v: T) => void): HTMLElement {
  const g = h("div", "bl-seg");
  g.setAttribute("role", "radiogroup");
  g.setAttribute("aria-label", label);
  for (const v of values) {
    const b = h("button", "bl-seg-btn", labels[v]);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(v === current));
    b.addEventListener("click", () => {
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      onChange(v);
    });
    g.append(b);
  }
  return g;
}

// ---------- Colour wheel ----------

function hsvToHex(hh: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + hh / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hh = 0;
  if (d > 0) {
    if (max === r) hh = ((g - b) / d + 6) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
  }
  return [hh * 60, max === 0 ? 0 : d / max, max];
}

const WHEEL = 196;

/** A swatch that opens a hue/saturation wheel with brightness, hex entry and presets. */
function colorWheel(current: string, label: string, onChange: (v: string) => void): HTMLElement {
  const wrap = h("div", "bl-colour");
  const swatch = h("button", "bl-swatch");
  swatch.type = "button";
  swatch.setAttribute("aria-label", `${label}: ${current}`);
  swatch.setAttribute("aria-expanded", "false");
  swatch.style.background = current;
  wrap.append(swatch);

  let [hue, sat, val] = hexToHsv(current);
  let pop: HTMLElement | null = null;

  const emit = (hex: string, from?: "hex") => {
    swatch.style.background = hex;
    swatch.setAttribute("aria-label", `${label}: ${hex}`);
    if (pop) {
      const marker = pop.querySelector<HTMLElement>(".bl-wheel-marker")!;
      const r = sat * (WHEEL / 2 - 6);
      marker.style.transform = `translate(${WHEEL / 2 + Math.cos((hue * Math.PI) / 180) * r}px, ${WHEEL / 2 + Math.sin((hue * Math.PI) / 180) * r}px)`;
      marker.style.background = hex;
      pop.querySelector<HTMLElement>(".bl-wheel-canvas")!.style.filter = `brightness(${0.25 + val * 0.75})`;
      const v = pop.querySelector<HTMLInputElement>(".bl-wheel-value")!;
      v.style.setProperty("--bl-hue", hsvToHex(hue, sat, 1));
      if (from !== "hex") pop.querySelector<HTMLInputElement>(".bl-wheel-hex")!.value = hex;
    }
    onChange(hex);
  };

  const close = () => {
    pop?.remove();
    pop = null;
    swatch.setAttribute("aria-expanded", "false");
    wrap.ownerDocument.removeEventListener("pointerdown", outside, true);
  };
  const outside = (e: Event) => {
    if (pop && !wrap.contains(e.target as Node)) close();
  };

  const open = () => {
    pop = h("div", "bl-wheel-pop");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `${label} colour`);
    const area = h("div", "bl-wheel");
    const canvas = h("canvas", "bl-wheel-canvas");
    canvas.width = canvas.height = WHEEL;
    const g = canvas.getContext("2d")!;
    const img = g.createImageData(WHEEL, WHEEL);
    const c = WHEEL / 2;
    for (let y = 0; y < WHEEL; y++) {
      for (let x = 0; x < WHEEL; x++) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        const i = (y * WHEEL + x) * 4;
        if (d > c) continue;
        const hex = hsvToHex(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, Math.min(1, d / (c - 6)), 1);
        const n = Number.parseInt(hex.slice(1), 16);
        img.data[i] = (n >> 16) & 255;
        img.data[i + 1] = (n >> 8) & 255;
        img.data[i + 2] = n & 255;
        img.data[i + 3] = d > c - 1 ? 255 * (c - d) : 255;
      }
    }
    g.putImageData(img, 0, 0);
    const marker = h("span", "bl-wheel-marker");
    area.append(canvas, marker);
    const pick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - rect.left - c;
      const dy = e.clientY - rect.top - c;
      hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      sat = Math.min(1, Math.hypot(dx, dy) / (c - 6));
      emit(hsvToHex(hue, sat, val));
    };
    area.addEventListener("pointerdown", (e) => {
      area.setPointerCapture(e.pointerId);
      pick(e);
      const move = (ev: PointerEvent) => pick(ev);
      const up = () => {
        area.removeEventListener("pointermove", move);
        area.removeEventListener("pointerup", up);
      };
      area.addEventListener("pointermove", move);
      area.addEventListener("pointerup", up);
    });

    const value = h("input", "bl-wheel-value");
    value.type = "range";
    value.min = "0";
    value.max = "1";
    value.step = "0.01";
    value.value = String(val);
    value.setAttribute("aria-label", "Brightness");
    value.addEventListener("input", () => {
      val = Number(value.value);
      emit(hsvToHex(hue, sat, val));
    });

    const hexRow = h("div", "bl-wheel-row");
    const hexIn = h("input", "bl-wheel-hex");
    hexIn.type = "text";
    hexIn.spellcheck = false;
    hexIn.maxLength = 7;
    hexIn.value = current;
    hexIn.setAttribute("aria-label", "Hex colour");
    hexIn.addEventListener("input", () => {
      const v = hexIn.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        [hue, sat, val] = hexToHsv(v.toLowerCase());
        value.value = String(val);
        emit(v.toLowerCase(), "hex");
      }
    });
    hexRow.append(hexIn);

    const presets = h("div", "bl-wheel-presets");
    for (const p of PRESETS) {
      const b = h("button", "bl-wheel-preset");
      b.type = "button";
      b.style.background = p;
      b.setAttribute("aria-label", p);
      b.addEventListener("click", () => {
        [hue, sat, val] = hexToHsv(p);
        value.value = String(val);
        emit(p);
      });
      presets.append(b);
    }
    pop.append(area, value, hexRow, presets);
    // Open upward when there is not enough room below inside the dialog.
    const scroller = wrap.closest(".bl-panel");
    const room = scroller ? scroller.getBoundingClientRect().bottom - swatch.getBoundingClientRect().bottom : 999;
    pop.classList.toggle("bl-up", room < 340);
    wrap.append(pop);
    swatch.setAttribute("aria-expanded", "true");
    emit(hsvToHex(hue, sat, val));
    wrap.ownerDocument.addEventListener("pointerdown", outside, true);
  };

  swatch.addEventListener("click", () => (pop ? close() : open()));
  return wrap;
}

// ---------- Dialog ----------

export function openSettings(host: HTMLElement, settings: Settings, onChange: Change, companionConnected: boolean | null, options: SettingsOptions = {}): void {
  const doc = host.ownerDocument;
  let s: Settings = { ...settings };
  let tab: Tab = "lyrics";
  const set = (patch: Partial<Settings>, rerender = false) => {
    s = { ...s, ...patch };
    onChange(patch);
    if (rerender) render();
  };

  const scrim = h("div", "bl-scrim");
  const dialog = h("div", "bl-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Bountiful Lyrics settings");
  const close = () => {
    scrim.remove();
    doc.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (dialog.querySelector(".bl-wheel-pop")) return;
      close();
    }
  };
  doc.addEventListener("keydown", onKey, true);
  scrim.addEventListener("mousedown", (e) => e.target === scrim && close());

  const header = h("header", "bl-dialog-head");
  const titleBox = h("div", "bl-dialog-titles");
  titleBox.append(h("h2", "bl-dialog-title", "Bountiful Lyrics"), h("p", "bl-dialog-sub", "Make it yours. Changes apply instantly."));
  const doneBtn = h("button", "bl-btn", "Done");
  doneBtn.type = "button";
  doneBtn.addEventListener("click", close);
  header.append(titleBox, doneBtn);

  const nav = h("nav", "bl-tabs");
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-orientation", "vertical");
  const panel = h("div", "bl-panel");
  panel.setAttribute("role", "tabpanel");
  const TABS: Array<[Tab, string, string]> = [
    ["lyrics", "Lyrics", "M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4z"],
    ["look", "Look", "M4 4h16v16H4zm2 2v9l3-3 3 3 4-5 2 2V6z"],
    ["colour", "Colour", "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.8-9-7.8ZM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"],
    ["glow", "Edge glow", "M3 3h18v18H3zm2 2v14h14V5z"],
    ["more", "More", "M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"],
  ];
  for (const [id, label, icon] of TABS) {
    const b = h("button", "bl-tab");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.tab = id;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg>`; // Constant markup only.
    b.append(h("span", "", label));
    b.addEventListener("click", () => {
      tab = id;
      render();
    });
    nav.append(b);
  }

  const section = (title: string, ...children: HTMLElement[]) => {
    const sec = h("section", "bl-section");
    sec.append(h("h3", "bl-section-title", title), ...children);
    return sec;
  };

  const renderLyrics = () => {
    const cards = h("div", "bl-cards");
    for (const id of STYLE_IDS) {
      const info = STYLE_INFO[id];
      const card = h("button", "bl-card");
      card.type = "button";
      card.setAttribute("aria-pressed", String(s.style === id));
      const art = h("span", "bl-card-art");
      art.innerHTML = info.art; // Constant markup only.
      card.append(art, h("span", "bl-card-name", info.name), h("span", "bl-card-blurb", info.blurb));
      card.addEventListener("click", () => set({ style: id }, true));
      cards.append(card);
    }
    const fonts = h("div", "bl-fonts");
    for (const id of FONT_IDS) {
      const b = h("button", "bl-font");
      b.type = "button";
      b.setAttribute("aria-pressed", String(s.font === id));
      const sample = h("span", "bl-font-sample", "Aa");
      sample.style.fontFamily = FONT_STACKS[id];
      b.append(sample, h("span", "bl-font-name", FONT_LABELS[id]));
      b.addEventListener("click", () => set({ font: id }, true));
      fonts.append(b);
    }
    const parts: HTMLElement[] = [
      section("Style", cards),
      section("Text", row("Text size", slider(0.6, 1.6, 0.05, s.textScale, (v) => `${Math.round(v * 100)}%`, "Text size", (textScale) => set({ textScale })))),
      section(
        "Timing",
        row(
          "Lyrics timing",
          slider(-1000, 1000, 25, s.lyricsOffsetMs, (v) => (v === 0 ? "Default" : v > 0 ? `${v} ms earlier` : `${-v} ms later`), "Lyrics timing", (lyricsOffsetMs) => set({ lyricsOffsetMs })),
          "Lyrics late? Move right. Early? Move left.",
        ),
      ),
    ];
    if (s.style === "constellation") {
      parts.push(
        section(
          "Constellation",
          row("Star size", slider(0.5, 2.5, 0.05, s.starScale, (v) => `${Math.round(v * 100)}%`, "Star size", (starScale) => set({ starScale }))),
          row("Word size", slider(0.6, 2.4, 0.05, s.starTextScale, (v) => `${Math.round(v * 100)}%`, "Word size", (starTextScale) => set({ starTextScale })), "Size of the words beside the stars"),
        ),
      );
    }
    if (s.style === "fisheye" || s.style === "codestyle") {
      parts.push(section("Lens", row("Tilt", slider(0, 1, 0.05, s.tilt, (v) => (v === 0 ? "Off" : `${Math.round(v * 100)}%`), "Tilt", (tilt) => set({ tilt })), "Each lyric leans and bends a little, like a real lens")));
    }
    parts.push(section("Font", fonts));
    return parts;
  };

  const renderLook = () => {
    const tiles = h("div", "bl-bgs");
    for (const id of BACKGROUND_IDS) {
      const info = BACKGROUND_INFO[id];
      const b = h("button", "bl-bg-tile");
      b.type = "button";
      b.setAttribute("aria-pressed", String(s.background === id));
      const prev = h("span", "bl-bg-preview");
      prev.style.background = info.swatch;
      b.append(prev, h("span", "bl-bg-name", info.name));
      b.addEventListener("click", () => set({ background: id }, true));
      tiles.append(b);
    }
    const parts = [section("Background", tiles)];
    if (options.display) parts.push(section("Open in", segmented(DISPLAY_IDS, DISPLAY_LABELS, s.display, "Open in", (display) => set({ display }))));
    return parts;
  };

  const renderColour = () => {
    const rows: HTMLElement[] = [row("Set colours manually", toggle(s.manualColors, "Set colours manually", (manualColors) => set({ manualColors }, true)), "Off: colours come from the album art")];
    if (s.manualColors) {
      rows.push(
        row("Lyric", colorWheel(s.lyricColor, "Lyric", (lyricColor) => set({ lyricColor }))),
        row("Highlight", colorWheel(s.highlightColor, "Highlight", (highlightColor) => set({ highlightColor }))),
        row("Secondary", colorWheel(s.secondaryColor, "Secondary", (secondaryColor) => set({ secondaryColor }))),
      );
    }
    return [section("Colour", ...rows)];
  };

  const renderGlow = () => {
    const rows: HTMLElement[] = [
      row("Show glow", toggle(s.glowEnabled, "Show glow", (glowEnabled) => set({ glowEnabled }))),
      row("Animation", segmented(GLOW_ANIMATIONS, GLOW_LABELS, s.glowAnimation, "Glow animation", (glowAnimation) => set({ glowAnimation }, true)), "Music Sync flashes edges on the beat · Orbit moves a half-frame arc around with each beat"),
      row("Two colours", toggle(s.glowColors === 2, "Two colours", (two) => set({ glowColors: two ? 2 : 1 }))),
      row("Thickness", slider(1, 10, 1, s.glowThickness, (v) => `${v}px`, "Thickness", (glowThickness) => set({ glowThickness }))),
      row("Strength", slider(0, 80, 1, s.glowStrength, (v) => `${v}`, "Glow strength", (glowStrength) => set({ glowStrength }))),
      row("Pick colours myself", toggle(s.glowOverride, "Pick glow colours myself", (glowOverride) => set({ glowOverride }, true)), "Off: the glow follows the album art"),
    ];
    if (s.glowAnimation === "music" || s.glowAnimation === "orbit") {
      rows.push(row("Light matches album", toggle(s.glowLightAuto, "Moving light matches album", (glowLightAuto) => set({ glowLightAuto }, true)), "The bright moving light; off lets you pick it"));
      if (!s.glowLightAuto) rows.push(row("Light colour", colorWheel(s.glowLight, "Moving light", (glowLight) => set({ glowLight }))));
    }
    if (s.glowOverride) {
      rows.push(
        row("Primary", colorWheel(s.glowPrimary, "Glow primary", (glowPrimary) => set({ glowPrimary }))),
        row("Secondary", colorWheel(s.glowSecondary, "Glow secondary", (glowSecondary) => set({ glowSecondary }))),
      );
    }
    return [section("Edge glow", ...rows)];
  };

  const renderMore = () => {
    const parts: HTMLElement[] = [];
    if (companionConnected !== null) {
      parts.push(
        section(
          "Desktop companion",
          row("Connect to companion app", toggle(s.companion, "Connect to companion app", (companion) => set({ companion }))),
          h("p", "bl-hint", companionConnected ? "Connected." : "Not connected. Start the companion app to show glow and lyrics outside Spotify."),
        ),
      );
    }
    const keys = h("dl", "bl-keys");
    for (const [k, v] of [
      ["S", "Settings"],
      ["1 – 4", "Constellation · Garden · Fisheye · Codestyle"],
      ["L", "Show or hide lyrics"],
      ["B", "Album art background on or off"],
      ["G", "Next glow animation"],
      ["← →", "Seek 5 seconds"],
      ["↑ ↓", "Volume"],
      ["M", "Mute"],
      ["I · F · P", "Inside Spotify · Fullscreen · Pop-out"],
      ["Space", "Play or pause (fullscreen and pop-out)"],
      ["Esc", "Close"],
    ]) {
      keys.append(h("dt", "", k!), h("dd", "", v!));
    }
    parts.push(section("Keyboard", keys));
    parts.push(section("Lyrics source", h("p", "bl-hint", "Timed lyrics come from Spotify first, then LRCLIB, a free open lyrics library. When neither has timing, the plain text is shown.")));
    return parts;
  };

  const render = () => {
    nav.querySelectorAll<HTMLButtonElement>(".bl-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    const scroll = panel.scrollTop;
    panel.replaceChildren(...(tab === "lyrics" ? renderLyrics() : tab === "look" ? renderLook() : tab === "colour" ? renderColour() : tab === "glow" ? renderGlow() : renderMore()));
    panel.scrollTop = scroll;
  };

  const body = h("div", "bl-dialog-body");
  body.append(nav, panel);

  const footer = h("footer", "bl-dialog-foot");
  const reset = h("button", "bl-btn bl-btn-quiet", "Reset to defaults");
  reset.type = "button";
  reset.addEventListener("click", () => {
    s = { ...DEFAULT_SETTINGS, display: s.display };
    onChange({ ...s });
    render();
  });
  footer.append(reset);

  dialog.append(header, body, footer);
  scrim.append(dialog);
  host.append(scrim);
  render();
  // Focus the dialog itself so keyboard users start inside it without a stray focus ring.
  dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
}

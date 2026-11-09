import { findStarted, flatten, type FlatWord, type SyncedLyrics } from "../lyrics/model";
import { el, hash, reducedMotion, type Renderer } from "./types";

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const P = (d: string) => `<path d="${d}"/>`;

/** Small glyphs that sit beside matching words. Only these constants are ever used as markup. */
const ICONS: Array<[RegExp, string]> = [
  [/^(love|loved|lover|loving|heart|hearts|darling|honey|crush|kiss)$/i, svg(P("M12 21C5 15.5 2 12 2 8a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 4-3 7.5-10 13Z"))],
  [/^(you|your|you're|youre|yourself|she|he|her|him|girl|boy|i|me|myself)$/i, svg(P("M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"))],
  [/^(give|gave|gift|gifts|giving)$/i, svg(P("M3 9h18v4H3zM5 13h14v8H5zM11 9h2v12h-2zM12 9C9 9 7 7.5 7.5 5.5S11 4 12 9Zm0 0c1-5 4-5 4.5-3.5S15 9 12 9Z"))],
  [/^(night|nights|midnight|moon|dark|tonight)$/i, svg(P("M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"))],
  [/^(fire|burn|burned|burning|flame|flames|hot|heat)$/i, svg(P("M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 4 1-2 2-5 1-9Z"))],
  [/^(star|stars|shine|shining|sky|light|lights)$/i, svg(P("M12 2 14.6 9.4 22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"))],
  [/^(sun|summer|day|morning|sunshine)$/i, svg(P("M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM11 0h2v4h-2zM11 20h2v4h-2zM0 11h4v2H0zM20 11h4v2h-4zM3.5 2.1l2.8 2.8-1.4 1.4L2.1 3.5zM17.7 19.1l2.8 2.8-1.4 1.4-2.8-2.8zM2.1 20.5l2.8-2.8 1.4 1.4-2.8 2.8zM19.1 6.3l2.8-2.8 1.4 1.4-2.8 2.8z"))],
  [/^(lose|lost|losing|no|never|nothing|gone|without)$/i, svg(P("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 5 1.5 1.5-3.5 3.5 3.5 3.5-1.5 1.5-3.5-3.5L8.5 17 7 15.5l3.5-3.5L7 8.5 8.5 7l3.5 3.5Z"))],
  [/^(cry|crying|tears|tear|rain|raining|sad)$/i, svg(P("M12 2s7 7.8 7 13a7 7 0 0 1-14 0c0-5.2 7-13 7-13Z"))],
  [/^(money|cash|rich|paid|dollar|dollars|gold)$/i, svg(P("M2 6h20v12H2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 9a2 2 0 0 1-1 1v4a2 2 0 0 1 1 1h1V9zm14 0v6h1a2 2 0 0 1 1-1v-4a2 2 0 0 1-1-1z"))],
  [/^(phone|call|calling|text|ring)$/i, svg(P("M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17v1h4v-1z"))],
  [/^(drive|driving|car|ride|road|cadillac)$/i, svg(P("M5 11 7 5h10l2 6h1a2 2 0 0 1 2 2v4h-2v2h-3v-2H7v2H4v-2H2v-4a2 2 0 0 1 2-2Zm2.2 0h9.6L15.6 7H8.4ZM6.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"))],
  [/^(music|song|songs|sing|singing|dance|dancing|radio)$/i, svg(P("M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h8V3Zm8 8.3a3.5 3.5 0 1 0 2 3.2V11z"))],
  [/^(home|house|room|bed)$/i, svg(P("M12 3 2 11h3v10h5v-6h4v6h5V11h3Z"))],
  [/^(time|forever|clock|minute|hour|wait|waiting)$/i, svg(P("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v4.6l3.7 2.2-1 1.7L11 12.7V7Z"))],
  [/^(eyes|eye|see|look|looking|watch|saw)$/i, svg(P("M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7Zm0 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"))],
  [/^(world|earth|everywhere|everybody|everyone|city)$/i, svg(P("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15 15 0 0 0-1.3-3.9A8 8 0 0 1 18.9 8ZM12 4c.9 1.2 1.6 2.6 2 4h-4c.4-1.4 1.1-2.8 2-4ZM4.3 14a8 8 0 0 1 0-4h3.4a17 17 0 0 0 0 4Zm.8 2h3a15 15 0 0 0 1.3 3.9A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.3-3.9A15 15 0 0 0 8.1 8ZM12 20c-.9-1.2-1.6-2.6-2-4h4c-.4 1.4-1.1 2.8-2 4Zm2.3-6H9.7a15 15 0 0 1 0-4h4.6a15 15 0 0 1 0 4Zm.3 5.9A15 15 0 0 0 15.9 16h3a8 8 0 0 1-4.3 3.9ZM16.3 14a17 17 0 0 0 0-4h3.4a8 8 0 0 1 0 4Z"))],
  [/^(kisses|lips|mouth)$/i, svg(P("M2 11c3-4 6-5 10-2 4-3 7-2 10 2-3 5-6 7-10 7s-7-2-10-7Zm3 .5c2 2 4.3 2.5 7 2.5s5-.5 7-2.5c-2 0-4.5.5-7 .5s-5-.5-7-.5Z"))],
  [/^(fly|flying|high|wings|free)$/i, svg(P("M2 12c4-1 7-4 10-9 3 5 6 8 10 9-4 1-7 3-10 9-3-6-6-8-10-9Z"))],
  [/^(king|queen|crown|boss|royal|throne|prince|princess)$/i, svg(P("M3 8l4 4 5-7 5 7 4-4-2 11H5Zm2 13h14v2H5z"))],
  [/^(dead|die|dying|death|kill|killed|grave|ghost|skull)$/i, svg(P("M12 2a9 9 0 0 0-9 9c0 3 1.5 5.2 3.5 6.5V21h3v-2h1v2h3v-2h1v2h3v-3.5A9 9 0 0 0 12 2ZM8.5 9.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 14l1.5 2.5h-3Z"))],
  [/^(fast|power|energy|electric|shock|thunder|lightning|crazy|wild)$/i, svg(P("M13 2 4 14h6l-1 8 9-12h-6Z"))],
  [/^(broke|broken|break|breaking|heartbreak|hurt|pain|cut)$/i, svg(P("M12 21C5 15.5 2 12 2 8a5.5 5.5 0 0 1 9-4.3L9.5 8l3 2-2 4 4-4.5-3-2 1.6-3.7A5.5 5.5 0 0 1 22 8c0 4-3 7.5-10 13Z"))],
  [/^(diamond|diamonds|ice|icy|jewel|bling|shine|chain|chains)$/i, svg(P("M6 3h12l4 6-10 12L2 9Zm1.2 2L5 8.5h4.2L10.7 5Zm6.1 0 1.5 3.5H19L16.8 5ZM5.4 10.5l5.3 6.3-2-6.3Zm7.9 6.3 5.3-6.3h-3.3ZM11 10.5l1 3.2 1-3.2Z"))],
  [/^(drink|drinks|drinking|drunk|wine|whiskey|liquor|bottle|sip|cup|henny)$/i, svg(P("M6 2h12l-1 8a5 5 0 0 1-4 4.9V20h3v2H8v-2h3v-5.1A5 5 0 0 1 7 10Zm1.3 3 .6 4h8.2l.6-4Z"))],
  [/^(smoke|smoking|smokin|smokin'|blunt|raws|weed|high|lit)$/i, svg(P("M2 15h15v4H2zm16 0h1.5v4H18zm2.5 0H22v4h-1.5zM16.5 13c0-2 2-2 2-4s-2-2-2-4h1.5c0 2 2 2 2 4s-2 2-2 4Zm3 0c0-2 1.5-2 1.5-3.5S19.5 7 19.5 6H21c0 1 1.5 1.5 1.5 3.5S21 11.5 21 13Z"))],
  [/^(cold|ice|snow|freeze|frozen|winter|chill)$/i, svg(P("M11 1h2v4.2l2.5-2.5 1.4 1.4L13 8v2.3l2-1.2 1.4-5.4 1.9.5-.9 3.4 3.6-2.1 1 1.7-3.6 2.1 3.4.9-.5 1.9-5.4-1.4-2 1.2 2 1.2 5.4-1.4.5 1.9-3.4.9 3.6 2.1-1 1.7-3.6-2.1.9 3.4-1.9.5-1.4-5.4-2-1.2V16l3.9 3.9-1.4 1.4-2.5-2.5V23h-2v-4.2l-2.5 2.5-1.4-1.4L11 16v-2.3l-2 1.2-1.4 5.4-1.9-.5.9-3.4-3.6 2.1-1-1.7 3.6-2.1-3.4-.9.5-1.9 5.4 1.4 2-1.2-2-1.2-5.4 1.4-.5-1.9 3.4-.9-3.6-2.1 1-1.7 3.6 2.1-.9-3.4 1.9-.5L9 9.1l2 1.2V8L7.1 4.1l1.4-1.4L11 5.2Z"))],
  [/^(happy|smile|smiling|laugh|laughing|fun|joy|lol)$/i, svg(P("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM6.5 13.5h11a5.5 5.5 0 0 1-11 0Z"))],
  [/^(god|pray|praying|prayer|heaven|angel|angels|bless|blessed|church|lord|soul)$/i, svg(P("M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM5 3c3 0 5 2 5.5 4.5L8 9C7 6.5 5.5 5 3 4.5 3.7 3.5 4.3 3 5 3Zm14 0c.7 0 1.3.5 2 1.5-2.5.5-4 2-5 4.5l-2.5-1.5C14 5 16 3 19 3ZM8 11h8l2 11H6Z"))],
  [/^(devil|hell|sin|sins|evil|demon|demons|wicked)$/i, svg(P("M4 2l3.5 4.2A8 8 0 0 1 12 5a8 8 0 0 1 4.5 1.2L20 2l.5 6A8 8 0 1 1 3.5 8ZM8.5 11l2.5 1.5-2.5 1.5Zm7 0v3L13 12.5ZM8 16.5h8l-1 2h-6Z"))],
  [/^(up|rise|rising|climb|higher|top|above|sky's)$/i, svg(P("M12 3l8 9h-5v9H9v-9H4Z"))],
  [/^(down|fall|falling|fell|low|lower|below|drown|drowning)$/i, svg(P("M12 21l-8-9h5V3h6v9h5Z"))],
  [/^(hand|hands|hold|holding|touch|touching|grab|reach)$/i, svg(P("M9 2h2v9h1V4h2v7h1V5h2v8h1V8h2v7a7 7 0 0 1-14 0v-3l-2-3 1.5-1L8 11V2Z"))],
  [/^(camera|picture|pictures|photo|photos|film|flash|pose)$/i, svg(P("M8 4h8l1.5 2H21a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5Zm4 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"))],
  [/^(listen|listening|hear|heard|sound|loud|speaker|bass|beat|beats)$/i, svg(P("M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h2a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9Z"))],
  [/^(secret|secrets|lock|locked|key|keys|safe|hide|hiding)$/i, svg(P("M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1Zm2 0h6V7a3 3 0 0 0-6 0Zm3 4a1.5 1.5 0 0 0-1 2.6V19h2v-2.4a1.5 1.5 0 0 0-1-2.6Z"))],
  [/^(sea|ocean|wave|waves|water|beach|river|swim|tide)$/i, svg(P("M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v2c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2Zm0-5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v2c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2Zm0 10c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2v2c-2.5 0-2.5-2-5-2s-2.5 2-5 2-2.5-2-5-2-2.5 2-5 2Z"))],
  [/^(flower|flowers|rose|roses|bloom|blooming|garden|petal|petals)$/i, svg(P("M12 2a3.5 3.5 0 0 1 3.4 4.3A3.5 3.5 0 1 1 17.7 12a3.5 3.5 0 1 1-3.4 5.7 3.5 3.5 0 1 1-4.6 0A3.5 3.5 0 1 1 6.3 12a3.5 3.5 0 1 1 2.3-5.7A3.5 3.5 0 0 1 12 2Zm0 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"))],
  [/^(dream|dreams|dreaming|sleep|sleeping|magic|wish|wishes)$/i, svg(P("M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6Zm8 9 1 2.8 2.8 1-2.8 1L18 19l-1-2.8-2.8-1 2.8-1ZM6 15l.8 2.2L9 18l-2.2.8L6 21l-.8-2.2L3 18l2.2-.8Z"))],
  [/^(run|running|ran|chase|chasing|escape|leave|leaving|gone|away)$/i, svg(P("M14 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-3.5 5 4 .5 2.5 3.5 3 .5-.3 2-4-.7-1.3-1.8-1.4 3.4 2.5 2.6-1 5.5-2-.4.8-4.4-2.6-2.4-1.5 3.6-4.7.4-.2-2 3.5-.3L11 10.4l-2 .9-1 3.2-1.9-.6 1.3-4Z"))],
  [/^(fight|fighting|war|battle|fist|strong|tough)$/i, svg(P("M6 9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 4 0v2h1V6a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7H9a3 3 0 0 1-3-3Z"))],
  [/^(party|celebrate|club|clubs|dance|turnt|turn)$/i, svg(P("M3 21 9 6l9 9Zm3.4-3.4 5.2-2.1-3.1-3.1ZM14 3h2v3h-2zm5 2 1.4 1.4-2.1 2.1-1.4-1.4ZM18 10h3v2h-3z"))],
  [/^(baby|babe|child|kid|kids|young|youth)$/i, svg(P("M12 3a8 8 0 0 1 8 8 8 8 0 0 1-16 0 8 8 0 0 1 8-8Zm-3 7a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 9 10Zm6 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm-5.5 4.5a3.5 3.5 0 0 0 5 0ZM12 3c1.5 0 2 1 1.5 2S11 6 11 4.5 11.5 3 12 3Z"))],
];

export const iconFor = (word: string): string | undefined => {
  const key = word.replace(/[^\p{L}'’]/gu, "").replace(/’/g, "'");
  const bare = key.replace(/^'+|'+$/g, "");
  // "smokin'" and "runnin'" should match their -ing words too.
  const ing = bare.endsWith("in") ? `${bare}g` : bare;
  return ICONS.find(([re]) => re.test(key) || re.test(bare) || re.test(ing))?.[1];
};

/** Scales a word down as it gets longer so the focus word always fits. */
export function focusScale(length: number): number {
  return Math.min(1, 7 / Math.max(1, length));
}

/** Angle between neighbouring words on the drum, in radians. */
const STEP = 0.62;
const VISIBLE = 2.6;
const SPRING = 16;

interface Slot {
  node: HTMLElement;
  index: number;
}

/**
 * Words sit on a vertical drum. The drum rolls with a spring toward the current word and smears
 * vertically while it moves, the way the reference rolls between words. The current word is big
 * and bright, neighbours shrink and fold away; upcoming words sometimes get an accent chip.
 */
export class FisheyeRenderer implements Renderer {
  private readonly wrap: HTMLElement;
  private readonly drum: HTMLElement;
  private readonly blur: SVGFEGaussianBlurElement;
  private readonly filterId = `bl-vblur-${Math.random().toString(36).slice(2, 8)}`;
  private words: FlatWord[] = [];
  private slots = new Map<number, Slot>();
  private pool: HTMLElement[] = [];
  private target = -1;
  private pos = -1;
  private lastFrame = 0;
  private blurLevel = -1;

  constructor(root: HTMLElement) {
    const doc = root.ownerDocument;
    this.wrap = el("div", "bl-fish", root);
    const defs = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    defs.setAttribute("class", "bl-fish-defs");
    defs.innerHTML = `<filter id="${this.filterId}" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="0 0"/></filter>`;
    this.wrap.appendChild(defs);
    this.blur = defs.querySelector("feGaussianBlur")!;
    this.drum = el("div", "bl-drum", this.wrap);
  }

  setLyrics(lyrics: SyncedLyrics): void {
    this.words = flatten(lyrics.lines);
    this.slots.forEach((s) => this.release(s.node));
    this.slots.clear();
    this.target = -1;
    this.pos = -1;
  }

  private release(node: HTMLElement): void {
    node.hidden = true;
    this.pool.push(node);
  }

  private fill(node: HTMLElement, index: number): void {
    const word = this.words[index]!;
    node.replaceChildren();
    // Each word leans and bends a little, like it sits on a curved lens. Scaled by the Tilt setting.
    const tilt = el("span", "bl-fish-tilt", node);
    const seed = hash(`tilt:${word.text}:${index}`);
    tilt.style.setProperty("--rz", String(((seed % 1000) / 1000 - 0.5) * 16));
    tilt.style.setProperty("--ry", String((((seed >>> 10) % 1000) / 1000 - 0.5) * 34));
    tilt.style.setProperty("--tx", String((((seed >>> 20) % 1000) / 1000 - 0.5) * 10));
    const text = el("span", "bl-fish-text", tilt);
    text.textContent = word.text;
    const icon = iconFor(word.text);
    if (icon) {
      const holder = el("span", "bl-fish-icon", tilt);
      holder.innerHTML = icon; // Only constants from ICONS, never lyric text.
    }
    const h = hash(`${word.text}:${index}`);
    const held = word.endMs - word.startMs;
    node.classList.toggle("bl-fish-chip", [...word.text].length >= 3 && (h % 3 === 0 || held > 1100));
    node.classList.toggle("bl-fish-italic", h % 7 === 1);
    node.style.setProperty("--bl-fit", String(focusScale([...word.text].length)));
    node.style.setProperty("--bl-chars", String(Math.max(3, [...word.text].length + (icon ? 1.2 : 0))));
  }

  private slot(index: number): Slot {
    let s = this.slots.get(index);
    if (!s) {
      const node = this.pool.pop() ?? el("div", "bl-fish-word", this.drum);
      node.hidden = false;
      this.fill(node, index);
      s = { node, index };
      this.slots.set(index, s);
    }
    return s;
  }

  update(positionMs: number): void {
    const index = findStarted(this.words, positionMs);
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    if (index !== this.target) {
      // Big jumps (seeking) snap instead of spinning through many words.
      if (Math.abs(index - this.pos) > 4) this.pos = index - Math.sign(index - this.pos) * 1;
      this.target = index;
    }
    const before = this.pos;
    if (reducedMotion()) this.pos = this.target;
    else this.pos += (this.target - this.pos) * (1 - Math.exp(-SPRING * dt));
    if (Math.abs(this.target - this.pos) < 0.001) this.pos = this.target;
    const velocity = Math.abs(this.pos - before) / Math.max(dt, 0.001);
    this.setBlur(Math.min(9, Math.max(0, velocity - 1.5) * 1.1));

    const lo = Math.ceil(this.pos - VISIBLE);
    const hi = Math.floor(this.pos + VISIBLE);
    for (const [i, s] of this.slots) {
      if (i < lo || i > hi || i < 0 || i >= this.words.length) {
        this.release(s.node);
        this.slots.delete(i);
      }
    }
    for (let i = Math.max(0, lo); i <= Math.min(this.words.length - 1, hi); i++) {
      if (this.target < 0) break;
      const { node } = this.slot(i);
      const d = i - this.pos;
      const angle = d * STEP;
      // Size falls off fast so the focus word dominates, like a fisheye lens.
      const scale = 1 - Math.min(1, Math.abs(d)) * 0.58 - Math.max(0, Math.abs(d) - 1) * 0.12;
      const y = Math.sin(angle) * 1.32;
      const z = (Math.cos(angle) - 1) * 1.9;
      node.style.transform = `translate3d(-50%, calc(-50% + ${y.toFixed(4)} * var(--bl-drum)), calc(${z.toFixed(4)} * var(--bl-drum))) rotateX(${(-angle).toFixed(4)}rad) scale(${scale.toFixed(4)})`;
      node.style.opacity = String(Math.max(0, Math.cos(angle * 0.95)) ** 1.4);
      const focus = Math.abs(d) < 0.5;
      node.classList.toggle("bl-fish-focus", focus);
      node.classList.toggle("bl-fish-next", d >= 0.5 && d < 1.5);
    }
  }

  private setBlur(amount: number): void {
    const level = Math.round(amount * 2) / 2;
    if (level === this.blurLevel) return;
    this.blurLevel = level;
    this.blur.setAttribute("stdDeviation", `0 ${level}`);
    this.drum.style.filter = level >= 0.5 ? `url(#${this.filterId})` : "";
  }

  destroy(): void {
    this.wrap.remove();
  }
}

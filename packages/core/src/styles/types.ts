import type { LoudSegment } from "../timing/loudness";
import type { SyncedLyrics } from "../lyrics/model";

export interface Renderer {
  setLyrics(lyrics: SyncedLyrics): void;
  /** Per-slice loudness from audio analysis, for styles that react to how hard a line is sung. */
  setLoudness?(segments: LoudSegment[]): void;
  /** Who sings each line (null when unknown), or null to forget. Index-aligned with the lyrics. */
  setSingers?(singers: Array<string[] | null> | null): void;
  update(positionMs: number): void;
  destroy(): void;
}

export const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Stable small hash, so decoration choices do not change between renders. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

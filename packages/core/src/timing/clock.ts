/** Drift below this is treated as reporting jitter, so displayed time never steps backward. */
const DRIFT_TOLERANCE_MS = 120;

/** Interpolates playback position between the player's coarse progress reports. */
export class PlaybackClock {
  private anchorPosition = 0;
  private anchorTime = 0;
  private playing = false;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Applies a player report. `force` is for seeks, track changes and play/pause. */
  sync(positionMs: number, playing: boolean, force = false): void {
    const drift = Math.abs(this.position() - positionMs);
    if (force || playing !== this.playing || drift > DRIFT_TOLERANCE_MS) {
      this.anchorPosition = positionMs;
      this.anchorTime = this.now();
      this.playing = playing;
    }
  }

  position(): number {
    return this.playing ? this.anchorPosition + (this.now() - this.anchorTime) : this.anchorPosition;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}

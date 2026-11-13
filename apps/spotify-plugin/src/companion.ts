import { COMPANION_PORT, parseControl, PROTOCOL_VERSION, type CompanionMessage, type ControlMessage } from "@bountiful/protocol";

const MIN_RETRY_MS = 3000;
const MAX_RETRY_MS = 60000;

/** Sends state to the desktop companion. Absence of the companion is normal and silent. */
export class CompanionLink {
  private socket: WebSocket | null = null;
  private retryMs = MIN_RETRY_MS;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;

  constructor(
    private readonly onConnected: () => void,
    private readonly onControl: (message: ControlMessage) => void = () => {},
  ) {}

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled) this.connect();
    else this.disconnect();
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send(message: CompanionMessage): void {
    if (this.connected) this.socket!.send(JSON.stringify(message));
  }

  private connect(): void {
    if (!this.enabled || this.socket) return;
    const socket = new WebSocket(`ws://127.0.0.1:${COMPANION_PORT}`);
    this.socket = socket;
    socket.onopen = () => {
      this.retryMs = MIN_RETRY_MS;
      this.send({ type: "hello", version: PROTOCOL_VERSION });
      this.onConnected();
    };
    socket.onclose = () => {
      this.socket = null;
      if (!this.enabled) return;
      this.timer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(MAX_RETRY_MS, this.retryMs * 2);
    };
    socket.onerror = () => socket.close();
    // Remote control from the companion window (validated before use).
    socket.onmessage = (e) => {
      const control = typeof e.data === "string" ? parseControl(e.data) : null;
      if (control) this.onControl(control);
    };
  }

  private disconnect(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close();
    this.socket = null;
  }
}

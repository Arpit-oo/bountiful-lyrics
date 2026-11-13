interface SpicetifyTrack {
  uri: string;
  name: string;
  artists?: Array<{ name: string }>;
  album?: { name: string };
  metadata: Record<string, string | undefined>;
}

interface SpicetifyPlayerState {
  item?: SpicetifyTrack;
  isPaused: boolean;
}

declare const Spicetify: {
  Player: {
    data?: SpicetifyPlayerState | null;
    addEventListener(type: "songchange" | "onplaypause" | "onprogress", cb: () => void): void;
    getProgress(): number;
    getDuration(): number;
    isPlaying(): boolean;
    togglePlay(): void;
    getVolume(): number;
    setVolume(volume: number): void;
    seek(positionMs: number): void;
    next(): void;
    back(): void;
  };
  Platform?: {
    History?: { listen(cb: () => void): () => void };
    AuthorizationAPI?: { getState?(): { token?: { accessToken?: string } } | undefined };
  };
  CosmosAsync?: { get(url: string): Promise<any> };
  LocalStorage: { get(key: string): string | null; set(key: string, value: string): void };
  Topbar: { Button: new (label: string, icon: string, onClick: () => void) => unknown };
  Playbar?: { Button: new (label: string, icon: string, onClick: () => void, disabled?: boolean, active?: boolean, registerOnCreate?: boolean) => unknown };
  getAudioData(uri?: string): Promise<{ beats?: Array<{ start: number; confidence?: number }> } | null>;
};

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
}

interface Window {
  BountifulLyrics?: unknown;
  documentPictureInPicture?: DocumentPictureInPicture;
}

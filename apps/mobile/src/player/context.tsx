import { createContext, useContext, useSyncExternalStore } from "react";
import type { PlayerQueueItem, PlaybackRate, RepeatMode } from "./types";

export type PlayerState = {
  queue: PlayerQueueItem[];
  current: PlayerQueueItem | null;
  index: number;
  isPlaying: boolean;
  rate: PlaybackRate | number;
  repeat: RepeatMode;
  toast: string | null;
};

export type PlayerApi = PlayerState & {
  playQueue: (
    items: PlayerQueueItem[],
    startIndex: number,
    startPositionMs?: number,
  ) => Promise<void>;
  /** Explicit user pick from Up next — resume allowed for that file. */
  playIndex: (index: number) => void;
  toggle: () => void;
  /** Pause if currently playing (e.g. before microphone recording). */
  pause: () => void;
  next: () => void;
  previous: () => void;
  /** Seek by a signed number of seconds, clamped to the track. */
  skipBy: (deltaSec: number) => void;
  seekTo: (seconds: number) => Promise<void>;
  setRate: (rate: number) => void;
  cycleRepeat: () => void;
  cycleSpeed: () => void;
  openFullPlayer: () => void;
  dismissToast: () => void;
  /** True while the hold-to-record overlay is visible — MiniPlayer hides. */
  isRecordingOverlay: boolean;
  setRecordingOverlay: (active: boolean) => void;
};

/** Position ticks. Subscribers re-render; the context value itself stays stable. */
export type PlayerProgress = {
  position: number;
  duration: number;
  isBuffering: boolean;
};

export type PlayerProgressStore = {
  getSnapshot: () => PlayerProgress;
  subscribe: (listener: () => void) => () => void;
  publish: (next: PlayerProgress) => void;
};

const EMPTY_PROGRESS: PlayerProgress = { position: 0, duration: 0, isBuffering: false };

export function createPlayerProgressStore(): PlayerProgressStore {
  let current = EMPTY_PROGRESS;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (next) => {
      if (
        current.position === next.position &&
        current.duration === next.duration &&
        current.isBuffering === next.isBuffering
      ) {
        return;
      }
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

export const PlayerContext = createContext<PlayerApi | null>(null);
export const PlayerProgressContext = createContext<PlayerProgressStore | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return ctx;
}

/** Safe for FileRow / screens that may render outside provider during tests. */
export function usePlayerOptional(): PlayerApi | null {
  return useContext(PlayerContext);
}

/** Seek bar and mini-player progress. Does not subscribe the rest of the tree. */
export function usePlayerProgress(): PlayerProgress {
  const store = useContext(PlayerProgressContext);
  if (!store) {
    throw new Error("usePlayerProgress must be used within PlayerProvider");
  }
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

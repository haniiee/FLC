import { createContext, useContext } from "react";
import type { PlayerQueueItem, PlaybackRate, RepeatMode } from "./types";

export type PlayerState = {
  queue: PlayerQueueItem[];
  current: PlayerQueueItem | null;
  index: number;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  rate: PlaybackRate | number;
  repeat: RepeatMode;
  toast: string | null;
};

export type PlayerApi = PlayerState & {
  playQueue: (items: PlayerQueueItem[], startIndex: number) => Promise<void>;
  /** Explicit user pick from Up next — resume allowed for that file. */
  playIndex: (index: number) => void;
  toggle: () => void;
  /** Pause if currently playing (e.g. before microphone recording). */
  pause: () => void;
  next: () => void;
  previous: () => void;
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

export const PlayerContext = createContext<PlayerApi | null>(null);

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

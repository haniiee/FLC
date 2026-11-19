import type { AudioPlaylistLoopMode } from "expo-audio";

export type RepeatMode = "off" | "all" | "one";

export type PlayerQueueItem = {
  fileId: string;
  displayName: string;
  topicDisplayName?: string;
  durationMs: number | null;
  url: string;
  sessionDisplayName: string;
  groupDisplayName: string;
};

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export function repeatToLoopMode(repeat: RepeatMode): AudioPlaylistLoopMode {
  if (repeat === "all") return "all";
  if (repeat === "one") return "single";
  return "none";
}

export function loopModeToRepeat(loop: AudioPlaylistLoopMode): RepeatMode {
  if (loop === "all") return "all";
  if (loop === "single") return "one";
  return "off";
}

export const MINI_PLAYER_HEIGHT = 64;

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

export type SavedPlayerSession = {
  sessionId: string;
  currentFileId: string;
  currentIndex: number;
  rate: number;
  repeatMode: RepeatMode;
  groupDisplayName: string;
  sessionDisplayName: string;
};

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

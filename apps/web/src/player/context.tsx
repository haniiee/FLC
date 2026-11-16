"use client";

import { createContext, useContext } from "react";

export type ChatVoicePlayInput = {
  messageId: string;
  url: string;
  senderName: string;
  durationMs: number | null;
};

export type PlayerApi = {
  playSession: (sessionId: string, startFileId?: string) => Promise<void>;
  /** Single-item chat voice queue (Media Session title/artist). Class playlist rebuilds on next playSession. */
  playChatVoice: (input: ChatVoicePlayInput) => Promise<void>;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSec: number) => void;
  setRate: (rate: number) => void;
  cycleRepeat: () => void;
  jumpTo: (index: number) => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  resumeSaved: () => Promise<void>;
  dismissResume: () => void;
  isCurrentFile: (fileId: string) => boolean;
  /** Rebuild playlist from server without stopping current playback. */
  refreshPlaylist: () => Promise<void>;
};

export const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer باید داخل PlayerProvider باشد");
  }
  return ctx;
}

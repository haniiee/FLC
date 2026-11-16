"use client";

import { createContext, useContext } from "react";

export type PlayerApi = {
  playSession: (sessionId: string, startFileId?: string) => Promise<void>;
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
};

export const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer باید داخل PlayerProvider باشد");
  }
  return ctx;
}

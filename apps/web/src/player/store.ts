"use client";

import { create } from "zustand";
import { cycleRepeatMode } from "./queue-logic";
import type { PlayerQueueItem, RepeatMode, SavedPlayerSession } from "./types";

type PlayerState = {
  queue: PlayerQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  repeatMode: RepeatMode;
  sourceSessionId: string | null;
  fullPlayerOpen: boolean;
  resumePrompt: SavedPlayerSession | null;
  hasActiveQueue: boolean;

  setQueue: (queue: PlayerQueueItem[], index: number, sessionId: string) => void;
  updateQueueUrls: (queue: PlayerQueueItem[]) => void;
  setCurrentIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setRate: (rate: number) => void;
  cycleRepeat: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setFullPlayerOpen: (open: boolean) => void;
  setResumePrompt: (prompt: SavedPlayerSession | null) => void;
  stop: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  rate: 1,
  repeatMode: "all",
  sourceSessionId: null,
  fullPlayerOpen: false,
  resumePrompt: null,
  hasActiveQueue: false,

  setQueue: (queue, index, sessionId) =>
    set({
      queue,
      currentIndex: index,
      sourceSessionId: sessionId,
      hasActiveQueue: queue.length > 0,
      position: 0,
      duration: 0,
    }),

  updateQueueUrls: (queue) => set({ queue }),

  setCurrentIndex: (index) => set({ currentIndex: index, position: 0, duration: 0 }),

  setPlaying: (isPlaying) => set({ isPlaying }),

  setPosition: (position) => set({ position }),

  setDuration: (duration) => set({ duration }),

  setRate: (rate) => set({ rate }),

  cycleRepeat: () => set((state) => ({ repeatMode: cycleRepeatMode(state.repeatMode) })),

  setRepeatMode: (repeatMode) => set({ repeatMode }),

  setFullPlayerOpen: (fullPlayerOpen) => set({ fullPlayerOpen }),

  setResumePrompt: (resumePrompt) => set({ resumePrompt }),

  stop: () =>
    set({
      isPlaying: false,
      position: 0,
    }),
}));

export function selectCurrentItem(state: PlayerState): PlayerQueueItem | null {
  if (!state.queue.length) {
    return null;
  }
  return state.queue[state.currentIndex] ?? null;
}

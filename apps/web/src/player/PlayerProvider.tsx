"use client";

import icon192 from "@app/brand/assets/icon-192.png";
import icon512 from "@app/brand/assets/icon-512.png";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { getApiClient } from "../lib/api";
import { apiErrorMessage } from "../lib/format";
import { PlayerContext, type PlayerApi } from "./context";
import { FullPlayer } from "./FullPlayer";
import { MiniPlayer } from "./MiniPlayer";
import {
  clearFilePosition,
  clearSavedSession,
  loadFilePosition,
  loadSavedSession,
  saveFilePosition,
  saveSavedSession,
} from "./persistence";
import {
  resolveEndedIndex,
  resolveNextIndex,
  resolvePrevIndex,
  resolveResumePosition,
  resolveSeekOnLoad,
} from "./queue-logic";
import { ResumeBanner } from "./ResumeBanner";
import { selectCurrentItem, usePlayerStore } from "./store";
import type { PlayerQueueItem } from "./types";

/** Tiny silent MP3 to unlock autoplay within a user gesture (esp. iOS). */
const SILENT_UNLOCK_SRC =
  "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

function applyPlaybackRate(audio: HTMLAudioElement, rate: number) {
  audio.playbackRate = rate;
  const anyAudio = audio as HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  anyAudio.preservesPitch = true;
  anyAudio.mozPreservesPitch = true;
  anyAudio.webkitPreservesPitch = true;
}

async function unlockAudio(audio: HTMLAudioElement) {
  const previous = audio.getAttribute("src");
  try {
    audio.muted = true;
    audio.src = SILENT_UNLOCK_SRC;
    audio.load();
    await audio.play();
    audio.pause();
  } catch {
    // Unlock best-effort; Chrome desktop usually does not need it.
  } finally {
    audio.muted = false;
    if (previous) {
      audio.src = previous;
    } else {
      audio.removeAttribute("src");
    }
  }
}

async function buildQueue(
  sessionId: string,
  meta: { sessionDisplayName: string; groupDisplayName: string },
): Promise<PlayerQueueItem[]> {
  const playlist = await getApiClient().getPlaylist(sessionId);
  return playlist.items.map((item) => ({
    fileId: item.fileId,
    displayName: item.displayName,
    topicDisplayName: item.topicDisplayName,
    durationMs: item.durationMs,
    url: item.url,
    sessionDisplayName: meta.sessionDisplayName,
    groupDisplayName: meta.groupDisplayName,
  }));
}

async function resolveSessionMeta(sessionId: string) {
  const sessionDetail = await getApiClient().getSession(sessionId);
  const group = await getApiClient().getGroup(sessionDetail.session.groupId);
  return {
    sessionDisplayName: sessionDetail.session.displayName,
    groupDisplayName: group.name,
  };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPersistAt = useRef(0);
  const mediaPosAt = useRef(0);
  const refreshingUrl = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const loadedFileId = useRef<string | null>(null);

  const persistNow = useCallback(() => {
    const state = usePlayerStore.getState();
    const item = selectCurrentItem(state);
    const audio = audioRef.current;
    if (!item || !audio || !state.sourceSessionId) {
      return;
    }
    const position = audio.currentTime || state.position;
    saveFilePosition(item.fileId, position);
    saveSavedSession({
      sessionId: state.sourceSessionId,
      currentFileId: item.fileId,
      currentIndex: state.currentIndex,
      rate: state.rate,
      repeatMode: state.repeatMode,
      groupDisplayName: item.groupDisplayName,
      sessionDisplayName: item.sessionDisplayName,
    });
  }, []);

  const updateMediaSession = useCallback(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const state = usePlayerStore.getState();
    const item = selectCurrentItem(state);
    if (!item) {
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.displayName,
      artist: item.topicDisplayName || item.sessionDisplayName,
      album: item.groupDisplayName,
      artwork: [
        { src: icon192.src, sizes: "192x192", type: "image/png" },
        { src: icon512.src, sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
    const duration = state.duration || (item.durationMs ? item.durationMs / 1000 : 0);
    if (duration > 0 && Number.isFinite(state.position)) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: state.rate,
          position: Math.min(state.position, duration),
        });
      } catch {
        // Some browsers throw if values are invalid
      }
    }
  }, []);

  const loadIndex = useCallback(
    (
      index: number,
      options?: {
        seekTo?: number;
        autoplay?: boolean;
        /** user-play / resume: restore saved pos; auto-advance: always 0 */
        reason?: "user-play" | "resume" | "auto-advance";
      },
    ) => {
      const audio = audioRef.current;
      const state = usePlayerStore.getState();
      const item = state.queue[index];
      if (!audio || !item) {
        return;
      }
      usePlayerStore.getState().setCurrentIndex(index);
      loadedFileId.current = item.fileId;
      const durationSec = item.durationMs ? item.durationMs / 1000 : 0;
      const reason = options?.reason ?? "auto-advance";
      const seekTo =
        options?.seekTo ?? resolveSeekOnLoad(reason, loadFilePosition(item.fileId), durationSec);
      pendingSeek.current = seekTo > 0 ? seekTo : null;
      audio.src = item.url;
      audio.load();
      applyPlaybackRate(audio, state.rate);
      updateMediaSession();
      if (options?.autoplay !== false) {
        void audio.play().then(
          () => usePlayerStore.getState().setPlaying(true),
          () => usePlayerStore.getState().setPlaying(false),
        );
      }
    },
    [updateMediaSession],
  );

  const goToResolvedIndex = useCallback(
    (nextIndex: number | null, options?: { seekTo?: number }) => {
      if (nextIndex === null) {
        const audio = audioRef.current;
        audio?.pause();
        usePlayerStore.getState().stop();
        persistNow();
        return;
      }
      loadIndex(nextIndex, {
        seekTo: options?.seekTo ?? 0,
        autoplay: true,
        reason: "auto-advance",
      });
    },
    [loadIndex, persistNow],
  );

  const playSession = useCallback(
    async (sessionId: string, startFileId?: string) => {
      const audio = audioRef.current;
      if (audio) {
        await unlockAudio(audio);
      }
      try {
        const meta = await resolveSessionMeta(sessionId);
        const queue = await buildQueue(sessionId, meta);
        if (queue.length === 0) {
          toast.error("ویس آماده‌ای برای پخش نیست");
          return;
        }
        let index = 0;
        if (startFileId) {
          const found = queue.findIndex((item) => item.fileId === startFileId);
          if (found >= 0) {
            index = found;
          }
        }
        const store = usePlayerStore.getState();
        store.setQueue(queue, index, sessionId);
        store.setResumePrompt(null);
        loadIndex(index, { autoplay: true, reason: "user-play" });
        persistNow();
      } catch (error) {
        toast.error(apiErrorMessage(error, "بارگذاری پلی‌لیست ناموفق بود"));
      }
    },
    [loadIndex, persistNow],
  );

  const resumeSaved = useCallback(async () => {
    const saved = usePlayerStore.getState().resumePrompt ?? loadSavedSession();
    if (!saved) {
      return;
    }
    const audio = audioRef.current;
    if (audio) {
      await unlockAudio(audio);
    }
    try {
      const meta = await resolveSessionMeta(saved.sessionId);
      const queue = await buildQueue(saved.sessionId, meta);
      if (queue.length === 0) {
        toast.error("ویس آماده‌ای برای پخش نیست");
        return;
      }
      let index = queue.findIndex((item) => item.fileId === saved.currentFileId);
      if (index < 0) {
        index = Math.min(saved.currentIndex, queue.length - 1);
      }
      const store = usePlayerStore.getState();
      store.setQueue(queue, index, saved.sessionId);
      store.setRate(saved.rate);
      store.setRepeatMode(saved.repeatMode);
      store.setResumePrompt(null);
      if (audio) {
        applyPlaybackRate(audio, saved.rate);
      }
      loadIndex(index, { autoplay: true, reason: "resume" });
      persistNow();
    } catch (error) {
      toast.error(apiErrorMessage(error, "ادامه‌ی پخش ناموفق بود"));
    }
  }, [loadIndex, persistNow]);

  const dismissResume = useCallback(() => {
    usePlayerStore.getState().setResumePrompt(null);
    clearSavedSession();
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const state = usePlayerStore.getState();
    if (!state.queue.length) {
      return;
    }
    if (audio.paused) {
      void audio.play().then(
        () => usePlayerStore.getState().setPlaying(true),
        () => usePlayerStore.getState().setPlaying(false),
      );
    } else {
      audio.pause();
      usePlayerStore.getState().setPlaying(false);
      persistNow();
    }
  }, [persistNow]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    void audio.play().then(
      () => usePlayerStore.getState().setPlaying(true),
      () => usePlayerStore.getState().setPlaying(false),
    );
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    usePlayerStore.getState().setPlaying(false);
    persistNow();
  }, [persistNow]);

  const next = useCallback(() => {
    const state = usePlayerStore.getState();
    const nextIndex = resolveNextIndex(state.currentIndex, state.queue.length, state.repeatMode);
    goToResolvedIndex(nextIndex, { seekTo: 0 });
  }, [goToResolvedIndex]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    const state = usePlayerStore.getState();
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      usePlayerStore.getState().setPosition(0);
      return;
    }
    const prevIndex = resolvePrevIndex(state.currentIndex, state.queue.length, state.repeatMode);
    if (prevIndex === null) {
      if (audio) {
        audio.currentTime = 0;
      }
      return;
    }
    goToResolvedIndex(prevIndex, { seekTo: 0 });
  }, [goToResolvedIndex]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(seconds)) {
        return;
      }
      const duration = audio.duration || usePlayerStore.getState().duration;
      const clamped = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
      audio.currentTime = clamped;
      usePlayerStore.getState().setPosition(clamped);
      updateMediaSession();
    },
    [updateMediaSession],
  );

  const skip = useCallback(
    (deltaSec: number) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      seek(audio.currentTime + deltaSec);
    },
    [seek],
  );

  const setRate = useCallback(
    (rate: number) => {
      usePlayerStore.getState().setRate(rate);
      const audio = audioRef.current;
      if (audio) {
        applyPlaybackRate(audio, rate);
      }
      persistNow();
      updateMediaSession();
    },
    [persistNow, updateMediaSession],
  );

  const cycleRepeat = useCallback(() => {
    usePlayerStore.getState().cycleRepeat();
    persistNow();
  }, [persistNow]);

  const jumpTo = useCallback(
    (index: number) => {
      loadIndex(index, { seekTo: 0, autoplay: true, reason: "auto-advance" });
    },
    [loadIndex],
  );

  const api = useMemo<PlayerApi>(
    () => ({
      playSession,
      toggle,
      play,
      pause,
      next,
      prev,
      seek,
      skip,
      setRate,
      cycleRepeat,
      jumpTo,
      openFullPlayer: () => usePlayerStore.getState().setFullPlayerOpen(true),
      closeFullPlayer: () => usePlayerStore.getState().setFullPlayerOpen(false),
      resumeSaved,
      dismissResume,
      isCurrentFile: (fileId) => selectCurrentItem(usePlayerStore.getState())?.fileId === fileId,
    }),
    [
      playSession,
      toggle,
      play,
      pause,
      next,
      prev,
      seek,
      skip,
      setRate,
      cycleRepeat,
      jumpTo,
      resumeSaved,
      dismissResume,
    ],
  );

  useEffect(() => {
    const saved = loadSavedSession();
    if (saved) {
      usePlayerStore.getState().setResumePrompt(saved);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => {
      const position = audio.currentTime;
      usePlayerStore.getState().setPosition(position);
      const now = Date.now();
      if (now - lastPersistAt.current >= 5000) {
        lastPersistAt.current = now;
        persistNow();
      }
      if (now - mediaPosAt.current >= 1000) {
        mediaPosAt.current = now;
        updateMediaSession();
      }
    };

    const onLoadedMetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      usePlayerStore.getState().setDuration(duration);
      if (pendingSeek.current !== null) {
        const seekTo = resolveResumePosition(pendingSeek.current, duration);
        audio.currentTime = seekTo;
        usePlayerStore.getState().setPosition(seekTo);
        pendingSeek.current = null;
      }
      applyPlaybackRate(audio, usePlayerStore.getState().rate);
      updateMediaSession();
    };

    const onPlay = () => {
      usePlayerStore.getState().setPlaying(true);
      updateMediaSession();
    };

    const onPause = () => {
      usePlayerStore.getState().setPlaying(false);
      persistNow();
      updateMediaSession();
    };

    const onEnded = () => {
      const state = usePlayerStore.getState();
      const endedItem = selectCurrentItem(state);
      if (endedItem) {
        clearFilePosition(endedItem.fileId);
      }
      if (state.repeatMode === "one") {
        audio.currentTime = 0;
        usePlayerStore.getState().setPosition(0);
        void audio.play();
        persistNow();
        return;
      }
      const nextIndex = resolveEndedIndex(state.currentIndex, state.queue.length, state.repeatMode);
      if (nextIndex === null) {
        usePlayerStore.getState().stop();
        persistNow();
        return;
      }
      const item = state.queue[nextIndex];
      if (!item) {
        usePlayerStore.getState().stop();
        return;
      }
      // Auto-advance / loop: always start next item from 0 (no saved resume).
      usePlayerStore.getState().setCurrentIndex(nextIndex);
      loadedFileId.current = item.fileId;
      pendingSeek.current = null;
      audio.src = item.url;
      audio.load();
      applyPlaybackRate(audio, state.rate);
      void audio.play();
      updateMediaSession();
      persistNow();
    };

    const onError = () => {
      void (async () => {
        const state = usePlayerStore.getState();
        const item = selectCurrentItem(state);
        if (!item || !state.sourceSessionId) {
          return;
        }
        if (refreshingUrl.current) {
          toast.error("پخش این ویس ممکن نیست");
          const nextIndex = resolveNextIndex(
            state.currentIndex,
            state.queue.length,
            state.repeatMode,
          );
          goToResolvedIndex(nextIndex, { seekTo: 0 });
          return;
        }
        refreshingUrl.current = true;
        const resumeAt = audio.currentTime || state.position;
        try {
          const meta = {
            sessionDisplayName: item.sessionDisplayName,
            groupDisplayName: item.groupDisplayName,
          };
          const queue = await buildQueue(state.sourceSessionId, meta);
          usePlayerStore.getState().updateQueueUrls(queue);
          const refreshed = queue.find((entry) => entry.fileId === item.fileId);
          if (!refreshed) {
            toast.error("این ویس دیگر در پلی‌لیست نیست");
            const nextIndex = resolveNextIndex(state.currentIndex, queue.length, state.repeatMode);
            goToResolvedIndex(nextIndex, { seekTo: 0 });
            return;
          }
          const index = queue.findIndex((entry) => entry.fileId === item.fileId);
          usePlayerStore.getState().setCurrentIndex(index >= 0 ? index : state.currentIndex);
          pendingSeek.current = resumeAt;
          audio.src = refreshed.url;
          audio.load();
          applyPlaybackRate(audio, state.rate);
          void audio.play().catch(() => {
            toast.error("پخش این ویس ممکن نیست");
            const nextIndex = resolveNextIndex(
              usePlayerStore.getState().currentIndex,
              usePlayerStore.getState().queue.length,
              usePlayerStore.getState().repeatMode,
            );
            goToResolvedIndex(nextIndex, { seekTo: 0 });
          });
        } catch (error) {
          toast.error(apiErrorMessage(error, "تازه‌سازی لینک پخش ناموفق بود"));
          const nextIndex = resolveNextIndex(
            state.currentIndex,
            state.queue.length,
            state.repeatMode,
          );
          goToResolvedIndex(nextIndex, { seekTo: 0 });
        } finally {
          refreshingUrl.current = false;
        }
      })();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [goToResolvedIndex, persistNow, updateMediaSession]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistNow();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", persistNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", persistNow);
    };
  }, [persistNow]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const bind = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported action
      }
    };
    bind("play", () => play());
    bind("pause", () => pause());
    bind("previoustrack", () => prev());
    bind("nexttrack", () => next());
    bind("seekbackward", () => skip(-15));
    bind("seekforward", () => skip(15));
    bind("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        seek(details.seekTime);
      }
    });
    return () => {
      for (const action of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ] as MediaSessionAction[]) {
        bind(action, null);
      }
    };
  }, [next, pause, play, prev, seek, skip]);

  const hasActiveQueue = usePlayerStore((s) => s.hasActiveQueue);
  const resumePrompt = usePlayerStore((s) => s.resumePrompt);
  const bottomPad = hasActiveQueue || resumePrompt ? "pb-24" : undefined;

  return (
    <PlayerContext.Provider value={api}>
      <div className={bottomPad}>{children}</div>
      <audio ref={audioRef} playsInline preload="auto" className="hidden" />
      <ResumeBanner />
      <MiniPlayer />
      <FullPlayer />
    </PlayerContext.Provider>
  );
}

export { usePlayer } from "./context";

import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { getApiClient } from "../lib/api";
import { copy } from "../lib/copy";
import {
  albumTitleFor,
  cycleRepeat as nextRepeat,
  cycleSpeed as nextSpeed,
  formatClock,
  isAtEnd,
  isNearEnd,
  shouldApplyResume,
  shouldPersistResume,
  shouldResume,
} from "./logic";
import {
  clearResumePosition,
  loadPlaybackRate,
  loadRepeatMode,
  loadResumePosition,
  savePlaybackRate,
  saveRepeatMode,
  saveResumePosition,
} from "./persistence";
import { MiniPlayer } from "./MiniPlayer";
import { ResumeToast } from "./ResumeToast";
import { PlayerContext, type PlayerApi } from "./context";
import { repeatToLoopMode, type PlayerQueueItem, type RepeatMode } from "./types";

type PlayerProviderProps = {
  children: ReactNode;
};

export function PlayerProvider({ children }: PlayerProviderProps) {
  const playlist = useAudioPlaylist({ sources: [], loop: "none", updateInterval: 250 });
  const status = useAudioPlaylistStatus(playlist);

  const [queue, setQueue] = useState<PlayerQueueItem[]>([]);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [rate, setRateState] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [isRecordingOverlay, setRecordingOverlay] = useState(false);
  const queueRef = useRef<PlayerQueueItem[]>([]);
  const lastPersistAt = useRef(0);
  const retriedFileId = useRef<string | null>(null);
  const applyingResume = useRef(false);
  const lastIndexRef = useRef(-1);
  const expectingPlayback = useRef(false);
  /** Only this fileId may receive resume (set by playQueue / playIndex). */
  const resumeAllowedFor = useRef<string | null>(null);
  const pendingResumeFileId = useRef<string | null>(null);
  const resumedFileIds = useRef(new Set<string>());
  const [resumeToken, setResumeToken] = useState(0);
  const lastPosByFileRef = useRef<Record<string, { time: number; duration: number }>>({});
  const rebuildingRef = useRef(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    const item = queueRef.current[status.currentIndex];
    if (!item) return;
    lastPosByFileRef.current[item.fileId] = {
      time: status.currentTime,
      duration: status.duration,
    };
  }, [status.currentIndex, status.currentTime, status.duration]);

  useEffect(() => {
    void (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      });
      if (Platform.OS === "android") {
        try {
          await requestNotificationPermissionsAsync();
        } catch {
          // Best-effort for lock-screen / notification controls.
        }
      }
      const [savedRate, savedRepeat] = await Promise.all([loadPlaybackRate(), loadRepeatMode()]);
      setRateState(savedRate);
      setRepeat(savedRepeat);
      playlist.playbackRate = savedRate;
      playlist.loop = repeatToLoopMode(savedRepeat);
    })();
  }, [playlist]);

  // Tear down lock-screen session only on provider unmount (not when playlist identity
  // is stable across renders) so reload does not leave a NONE media session behind.
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  useEffect(() => {
    return () => {
      const instance = playlistRef.current;
      try {
        instance.setActiveForLockScreen(false);
        instance.clearLockScreenControls();
        instance.destroy();
      } catch {
        // Hook may already have released the native playlist.
      }
    };
  }, []);

  const current = queue[status.currentIndex] ?? null;

  const lockMetadata = useCallback(
    (item: PlayerQueueItem | null) => {
      if (!item) return;
      playlist.updateLockScreenMetadata({
        title: item.displayName,
        artist: item.groupDisplayName,
        albumTitle: albumTitleFor(item),
      });
    },
    [playlist],
  );

  const activateLockScreen = useCallback(
    (item: PlayerQueueItem | null) => {
      if (!item) return;
      playlist.setActiveForLockScreen(
        true,
        {
          title: item.displayName,
          artist: item.groupDisplayName,
          albumTitle: albumTitleFor(item),
        },
        { showNextTrack: true, showPreviousTrack: true },
      );
    },
    [playlist],
  );

  const persistPosition = useCallback(
    async (force = false) => {
      const item = queueRef.current[playlist.currentIndex];
      if (!item) return;
      const now = Date.now();
      if (!force && now - lastPersistAt.current < 5000) return;
      lastPersistAt.current = now;
      const pos = playlist.currentTime;
      const duration = playlist.currentStatus.duration;
      if (!shouldPersistResume(pos, duration)) return;
      await saveResumePosition(item.fileId, pos);
    },
    [playlist],
  );

  const applyResumeIfNeeded = useCallback(
    async (item: PlayerQueueItem) => {
      if (!shouldApplyResume("user-start")) return;
      if (resumeAllowedFor.current !== item.fileId) return;
      if (resumedFileIds.current.has(item.fileId)) return;
      const saved = await loadResumePosition(item.fileId);
      const durationSec =
        item.durationMs && item.durationMs > 0
          ? item.durationMs / 1000
          : status.duration > 0
            ? status.duration
            : 0;
      if (!shouldResume(saved, durationSec)) {
        pendingResumeFileId.current = null;
        resumeAllowedFor.current = null;
        return;
      }
      applyingResume.current = true;
      try {
        setToast(copy.content.resumedAt(formatClock(saved)));
        await playlist.seekTo(saved);
        await new Promise((resolve) => setTimeout(resolve, 250));
        const pos = playlist.currentTime;
        if (pos > 0 && Math.abs(pos - saved) > 4) {
          return;
        }
        resumedFileIds.current.add(item.fileId);
        pendingResumeFileId.current = null;
        resumeAllowedFor.current = null;
      } catch {
        // Track may not be seekable yet; keep pending for a later attempt.
      } finally {
        applyingResume.current = false;
      }
    },
    [playlist, status.duration],
  );

  const replaceSources = useCallback(
    (items: PlayerQueueItem[]) => {
      rebuildingRef.current = true;
      try {
        while (playlist.trackCount > 0) {
          playlist.remove(0);
        }
        for (const item of items) {
          playlist.add({ uri: item.url, name: item.displayName });
        }
      } finally {
        rebuildingRef.current = false;
      }
    },
    [playlist],
  );

  const playQueue = useCallback(
    async (items: PlayerQueueItem[], startIndex: number) => {
      if (items.length === 0) return;
      const index = Math.max(0, Math.min(startIndex, items.length - 1));
      const startItem = items[index]!;
      setQueue(items);
      queueRef.current = items;
      // Mark resume target before mutating sources so trackChanged cannot clear it.
      resumeAllowedFor.current = startItem.fileId;
      resumedFileIds.current.delete(startItem.fileId);
      pendingResumeFileId.current = startItem.fileId;
      replaceSources(items);
      playlist.loop = repeatToLoopMode(repeat);
      playlist.playbackRate = rate;
      playlist.skipTo(index);
      setResumeToken((value) => value + 1);
      expectingPlayback.current = true;
      playlist.play();
      activateLockScreen(startItem);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      retriedFileId.current = null;
      lastIndexRef.current = index;
    },
    [activateLockScreen, playlist, rate, repeat, replaceSources],
  );

  const playIndex = useCallback(
    (index: number) => {
      const item = queueRef.current[index];
      if (!item) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      resumeAllowedFor.current = item.fileId;
      resumedFileIds.current.delete(item.fileId);
      pendingResumeFileId.current = item.fileId;
      playlist.skipTo(index);
      setResumeToken((value) => value + 1);
      expectingPlayback.current = true;
      playlist.play();
      activateLockScreen(item);
      lastIndexRef.current = index;
      retriedFileId.current = null;
    },
    [activateLockScreen, playlist],
  );

  const pause = useCallback(() => {
    if (!playlist.playing) return;
    playlist.pause();
    void persistPosition(true);
  }, [persistPosition, playlist]);

  const toggle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playlist.playing) {
      playlist.pause();
      void persistPosition(true);
      return;
    }

    // Repeat off + finished last track: restart from the beginning.
    if (isAtEnd(playlist.currentTime, playlist.currentStatus.duration)) {
      resumeAllowedFor.current = null;
      pendingResumeFileId.current = null;
      playlist.skipTo(0);
      void playlist.seekTo(0).then(() => {
        expectingPlayback.current = true;
        playlist.play();
        const first = queueRef.current[0];
        if (first) activateLockScreen(first);
      });
      lastIndexRef.current = 0;
      return;
    }

    expectingPlayback.current = true;
    playlist.play();
    if (current) activateLockScreen(current);
  }, [activateLockScreen, current, persistPosition, playlist]);

  const next = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void persistPosition(true);
    resumeAllowedFor.current = null;
    pendingResumeFileId.current = null;
    playlist.next();
  }, [persistPosition, playlist]);

  const previous = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void persistPosition(true);
    if (playlist.currentTime > 3) {
      void playlist.seekTo(0);
      return;
    }
    resumeAllowedFor.current = null;
    pendingResumeFileId.current = null;
    playlist.previous();
  }, [persistPosition, playlist]);

  const seekTo = useCallback(
    async (seconds: number) => {
      await playlist.seekTo(Math.max(0, seconds));
    },
    [playlist],
  );

  const setRate = useCallback(
    (nextRate: number) => {
      setRateState(nextRate);
      playlist.playbackRate = nextRate;
      void savePlaybackRate(nextRate);
    },
    [playlist],
  );

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const value = nextRepeat(prev);
      playlist.loop = repeatToLoopMode(value);
      void saveRepeatMode(value);
      return value;
    });
  }, [playlist]);

  const cycleSpeed = useCallback(() => {
    setRateState((prev) => {
      const value = nextSpeed(prev);
      playlist.playbackRate = value;
      void savePlaybackRate(value);
      return value;
    });
  }, [playlist]);

  const openFullPlayer = useCallback(() => {
    router.push("/player");
  }, []);

  // Persist every ~5s while playing (skip last 5s of a track).
  useEffect(() => {
    if (!status.playing) return;
    void persistPosition(false);
  }, [status.currentTime, status.playing, persistPosition]);

  // Track change: clear finished-track resume, lock metadata, seek 0 unless user-start resume.
  useEffect(() => {
    const sub = playlist.addListener("trackChanged", ({ previousIndex, currentIndex }) => {
      if (rebuildingRef.current) {
        lastIndexRef.current = currentIndex;
        return;
      }

      const prevFromRef = lastIndexRef.current;
      const prevIndex = previousIndex >= 0 ? previousIndex : prevFromRef;
      const prevItem = queueRef.current[prevIndex];
      if (prevItem && prevIndex !== currentIndex) {
        const snap = lastPosByFileRef.current[prevItem.fileId];
        if (snap && isNearEnd(snap.time, snap.duration)) {
          void clearResumePosition(prevItem.fileId);
        }
      }

      const item = queueRef.current[currentIndex];
      if (!item) {
        lastIndexRef.current = currentIndex;
        return;
      }
      lockMetadata(item);
      playlist.playbackRate = rate;

      const allowResume =
        shouldApplyResume("user-start") && resumeAllowedFor.current === item.fileId;

      if (allowResume) {
        pendingResumeFileId.current = item.fileId;
        setResumeToken((value) => value + 1);
      } else {
        pendingResumeFileId.current = null;
        resumeAllowedFor.current = null;
        void playlist.seekTo(0);
      }

      lastIndexRef.current = currentIndex;
    });
    return () => sub.remove();
  }, [lockMetadata, playlist, rate]);

  // Apply resume once the current track is loaded/seekable (user-start only).
  useEffect(() => {
    const ready = status.isLoaded || status.duration > 0 || status.playing;
    if (!ready) return;
    if (applyingResume.current) return;
    const item = queueRef.current[status.currentIndex];
    if (!item) return;
    if (pendingResumeFileId.current !== item.fileId) return;
    if (resumeAllowedFor.current !== item.fileId) return;
    void applyResumeIfNeeded(item);
  }, [
    applyResumeIfNeeded,
    resumeToken,
    status.currentIndex,
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.playing,
  ]);

  const retryCurrentUrl = useCallback(async () => {
    const index = playlist.currentIndex;
    const item = queueRef.current[index];
    if (!item) return;
    if (retriedFileId.current === item.fileId) return;
    retriedFileId.current = item.fileId;
    try {
      const { url } = await getApiClient().getFileUrl(item.fileId, false);
      const nextQueue = queueRef.current.map((entry, i) =>
        i === index ? { ...entry, url } : entry,
      );
      setQueue(nextQueue);
      queueRef.current = nextQueue;
      playlist.remove(index);
      playlist.insert({ uri: url, name: item.displayName }, index);
      playlist.skipTo(index);
      playlist.playbackRate = rate;
      expectingPlayback.current = true;
      playlist.play();
      activateLockScreen({ ...item, url });
    } catch {
      expectingPlayback.current = false;
    }
  }, [activateLockScreen, playlist, rate]);

  // Presigned URL failure: one retry when playback was expected but never loaded.
  useEffect(() => {
    if (status.playing || status.isLoaded) {
      expectingPlayback.current = false;
      return;
    }
    if (!expectingPlayback.current) return;
    if (status.isBuffering) return;
    if (!current) return;
    if (retriedFileId.current === current.fileId) return;
    const timer = setTimeout(() => {
      void retryCurrentUrl();
    }, 1200);
    return () => clearTimeout(timer);
  }, [current, retryCurrentUrl, status.isBuffering, status.isLoaded, status.playing]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const api = useMemo<PlayerApi>(
    () => ({
      queue,
      current,
      index: status.currentIndex,
      isPlaying: status.playing,
      isBuffering: status.isBuffering,
      position: status.currentTime,
      duration: status.duration,
      rate,
      repeat,
      toast,
      playQueue,
      playIndex,
      toggle,
      pause,
      next,
      previous,
      seekTo,
      setRate,
      cycleRepeat,
      cycleSpeed,
      openFullPlayer,
      dismissToast: () => setToast(null),
      isRecordingOverlay,
      setRecordingOverlay,
    }),
    [
      queue,
      current,
      status.currentIndex,
      status.playing,
      status.isBuffering,
      status.currentTime,
      status.duration,
      rate,
      repeat,
      toast,
      playQueue,
      playIndex,
      toggle,
      pause,
      next,
      previous,
      seekTo,
      setRate,
      cycleRepeat,
      cycleSpeed,
      openFullPlayer,
      isRecordingOverlay,
    ],
  );

  return (
    <PlayerContext.Provider value={api}>
      <View style={{ flex: 1 }}>
        {children}
        <MiniPlayer />
        {toast ? <ResumeToast message={toast} /> : null}
      </View>
    </PlayerContext.Provider>
  );
}

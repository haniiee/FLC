import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
  type AudioPlaylist,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Platform, View } from "react-native";
import { getApiClient } from "../lib/api";
import { copy } from "../lib/copy";
import {
  albumTitleFor,
  clampSkipPosition,
  cycleRepeat as nextRepeat,
  cycleSpeed as nextSpeed,
  formatClock,
  isAtEnd,
  isNearEnd,
  shouldApplyResume,
  shouldPersistResume,
  shouldResume,
  stepTransport,
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
import {
  PlayerContext,
  PlayerProgressContext,
  createPlayerProgressStore,
  type PlayerApi,
  type PlayerProgressStore,
} from "./context";
import { repeatToLoopMode, type PlayerQueueItem, type RepeatMode } from "./types";

type PlayerProviderProps = {
  children: ReactNode;
};

type PlayerRuntime = {
  queueRef: MutableRefObject<PlayerQueueItem[]>;
  indexRef: MutableRefObject<number>;
  positionRef: MutableRefObject<number>;
  positionHold: MutableRefObject<number | null>;
  commandedIndex: MutableRefObject<number | null>;
  commandAt: MutableRefObject<number>;
  repeatRef: MutableRefObject<RepeatMode>;
  rateRef: MutableRefObject<number>;
  lastPersistAt: MutableRefObject<number>;
  retriedFileId: MutableRefObject<string | null>;
  applyingResume: MutableRefObject<boolean>;
  expectingPlayback: MutableRefObject<boolean>;
  resumeAllowedFor: MutableRefObject<string | null>;
  pendingResumeFileId: MutableRefObject<string | null>;
  resumedFileIds: MutableRefObject<Set<string>>;
  lastPosByFileRef: MutableRefObject<Record<string, { time: number; duration: number }>>;
  rebuildingRef: MutableRefObject<boolean>;
  wrapGuard: MutableRefObject<boolean>;
  playlistRef: MutableRefObject<AudioPlaylist>;
  aliveRef: MutableRefObject<boolean>;
  progress: PlayerProgressStore;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setIndex: Dispatch<SetStateAction<number>>;
  setResumeToken: Dispatch<SetStateAction<number>>;
  setToast: Dispatch<SetStateAction<string | null>>;
  setQueue: Dispatch<SetStateAction<PlayerQueueItem[]>>;
};

export function PlayerProvider({ children }: PlayerProviderProps) {
  const playlist = useAudioPlaylist({ sources: [], loop: "all", updateInterval: 250 });

  const [queue, setQueue] = useState<PlayerQueueItem[]>([]);
  const [repeat, setRepeat] = useState<RepeatMode>("all");
  const [rate, setRateState] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [isRecordingOverlay, setRecordingOverlay] = useState(false);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resumeToken, setResumeToken] = useState(0);

  const queueRef = useRef<PlayerQueueItem[]>([]);
  const lastPersistAt = useRef(0);
  const retriedFileId = useRef<string | null>(null);
  const applyingResume = useRef(false);
  const indexRef = useRef(0);
  const positionRef = useRef(0);
  const positionHold = useRef<number | null>(null);
  const commandedIndex = useRef<number | null>(null);
  const commandAt = useRef(0);
  const expectingPlayback = useRef(false);
  /** Only this fileId may receive resume (set by playQueue / playIndex). */
  const resumeAllowedFor = useRef<string | null>(null);
  const pendingResumeFileId = useRef<string | null>(null);
  const resumedFileIds = useRef(new Set<string>());
  const lastPosByFileRef = useRef<Record<string, { time: number; duration: number }>>({});
  const rebuildingRef = useRef(false);
  const wrapGuard = useRef(false);
  const repeatRef = useRef<RepeatMode>("all");
  const rateRef = useRef(1);
  const playlistRef = useRef(playlist);
  const aliveRef = useRef(true);
  playlistRef.current = playlist;
  repeatRef.current = repeat;
  rateRef.current = rate;
  queueRef.current = queue;

  const progress = useMemo(() => createPlayerProgressStore(), []);
  const runtime = useMemo<PlayerRuntime>(
    () => ({
      queueRef,
      indexRef,
      positionRef,
      positionHold,
      commandedIndex,
      commandAt,
      repeatRef,
      rateRef,
      lastPersistAt,
      retriedFileId,
      applyingResume,
      expectingPlayback,
      resumeAllowedFor,
      pendingResumeFileId,
      resumedFileIds,
      lastPosByFileRef,
      rebuildingRef,
      wrapGuard,
      playlistRef,
      aliveRef,
      progress,
      setIsPlaying,
      setIndex,
      setResumeToken,
      setToast,
      setQueue,
    }),
    [progress],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      });
      if (cancelled || playlistRef.current !== playlist) return;
      if (Platform.OS === "android") {
        try {
          await requestNotificationPermissionsAsync();
        } catch {
          // Best-effort for lock-screen / notification controls.
        }
        if (cancelled || playlistRef.current !== playlist) return;
      }
      const [savedRate, savedRepeat] = await Promise.all([loadPlaybackRate(), loadRepeatMode()]);
      if (cancelled || playlistRef.current !== playlist) return;
      rateRef.current = savedRate;
      repeatRef.current = savedRepeat;
      setRateState(savedRate);
      setRepeat(savedRepeat);
      try {
        playlist.playbackRate = savedRate;
        playlist.loop = repeatToLoopMode(savedRepeat);
      } catch {
        // The playlist hook releases the native object on unmount.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playlist]);

  // useAudioPlaylist already releases the native playlist on unmount.
  // Clearing the lock-screen session here is enough; destroy() would release it twice.
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      const instance = playlistRef.current;
      try {
        instance.setActiveForLockScreen(false);
        instance.clearLockScreenControls();
      } catch {
        // Hook may already have released the native playlist.
      }
    };
  }, []);

  const publishProgress = useCallback(
    (position: number) => {
      const live = playlistRef.current.currentStatus;
      progress.publish({
        position,
        duration: live.duration,
        isBuffering: live.isBuffering,
      });
    },
    [progress],
  );

  const lockMetadata = useCallback((item: PlayerQueueItem | null) => {
    if (!item) return;
    playlistRef.current.updateLockScreenMetadata({
      title: item.displayName,
      artist: item.groupDisplayName,
      albumTitle: albumTitleFor(item),
    });
  }, []);

  const activateLockScreen = useCallback((item: PlayerQueueItem | null) => {
    if (!item) return;
    playlistRef.current.setActiveForLockScreen(
      true,
      {
        title: item.displayName,
        artist: item.groupDisplayName,
        albumTitle: albumTitleFor(item),
      },
      {
        showNextTrack: true,
        showPreviousTrack: true,
        showSeekForward: true,
        showSeekBackward: true,
        seekForwardIntervalSeconds: 10,
        seekBackwardIntervalSeconds: 10,
      },
    );
  }, []);

  const persistPosition = useCallback(async (force = false) => {
    const live = playlistRef.current;
    const item = queueRef.current[indexRef.current];
    if (!item) return;
    const now = Date.now();
    if (!force && now - lastPersistAt.current < 5000) return;
    lastPersistAt.current = now;
    const pos = positionRef.current;
    const duration = live.currentStatus.duration;
    if (!shouldPersistResume(pos, duration)) return;
    await saveResumePosition(item.fileId, pos);
  }, []);

  const replaceSources = useCallback((items: PlayerQueueItem[]) => {
    const live = playlistRef.current;
    rebuildingRef.current = true;
    try {
      while (live.trackCount > 0) {
        live.remove(0);
      }
      for (const item of items) {
        live.add({ uri: item.url, name: item.displayName });
      }
    } finally {
      rebuildingRef.current = false;
    }
  }, []);

  const playQueue = useCallback(
    async (items: PlayerQueueItem[], startIndex: number) => {
      if (items.length === 0) return;
      const live = playlistRef.current;
      const start = Math.max(0, Math.min(startIndex, items.length - 1));
      const startItem = items[start]!;
      setQueue(items);
      queueRef.current = items;
      // Mark resume target before mutating sources so trackChanged cannot clear it.
      resumeAllowedFor.current = startItem.fileId;
      resumedFileIds.current.delete(startItem.fileId);
      pendingResumeFileId.current = startItem.fileId;
      replaceSources(items);
      live.loop = repeatToLoopMode(repeatRef.current);
      live.playbackRate = rateRef.current;
      live.skipTo(start);
      indexRef.current = start;
      commandedIndex.current = start;
      commandAt.current = Date.now();
      positionRef.current = 0;
      setIndex(start);
      setResumeToken((value) => value + 1);
      expectingPlayback.current = true;
      live.play();
      activateLockScreen(startItem);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      retriedFileId.current = null;
    },
    [activateLockScreen, replaceSources],
  );

  const playIndex = useCallback(
    (nextIndex: number) => {
      const item = queueRef.current[nextIndex];
      if (!item) return;
      const live = playlistRef.current;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      resumeAllowedFor.current = item.fileId;
      resumedFileIds.current.delete(item.fileId);
      pendingResumeFileId.current = item.fileId;
      live.skipTo(nextIndex);
      indexRef.current = nextIndex;
      commandedIndex.current = nextIndex;
      commandAt.current = Date.now();
      positionRef.current = 0;
      setIndex(nextIndex);
      setResumeToken((value) => value + 1);
      expectingPlayback.current = true;
      live.play();
      activateLockScreen(item);
      retriedFileId.current = null;
    },
    [activateLockScreen],
  );

  const pause = useCallback(() => {
    const live = playlistRef.current;
    if (!live.playing) return;
    live.pause();
    void persistPosition(true);
  }, [persistPosition]);

  const toggle = useCallback(() => {
    const live = playlistRef.current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (live.playing) {
      live.pause();
      void persistPosition(true);
      return;
    }

    // Repeat off + finished last track: restart from the beginning.
    if (isAtEnd(positionRef.current, live.currentStatus.duration)) {
      resumeAllowedFor.current = null;
      pendingResumeFileId.current = null;
      indexRef.current = 0;
      commandedIndex.current = 0;
      commandAt.current = Date.now();
      positionRef.current = 0;
      positionHold.current = 0;
      setIndex(0);
      publishProgress(0);
      live.skipTo(0);
      void live
        .seekTo(0)
        .then(() => {
          if (!aliveRef.current || playlistRef.current !== live) return;
          expectingPlayback.current = true;
          live.play();
          const first = queueRef.current[0];
          if (first) activateLockScreen(first);
        })
        .catch(() => {
          // Seek can settle after the playlist has been released.
        });
      return;
    }

    expectingPlayback.current = true;
    live.play();
    const currentItem = queueRef.current[indexRef.current];
    if (currentItem) activateLockScreen(currentItem);
  }, [activateLockScreen, persistPosition, publishProgress]);

  const commitStep = useCallback(
    (direction: "previous" | "next") => {
      const live = playlistRef.current;
      const before = indexRef.current;
      const step = stepTransport(
        {
          index: before,
          positionSec: positionRef.current,
          queueLength: queueRef.current.length,
          repeat: repeatRef.current,
        },
        direction,
      );
      positionRef.current = step.positionSec;
      if (step.restart || !step.moved) {
        if (!step.restart) return;
        positionHold.current = 0;
        publishProgress(0);
        void live.seekTo(0);
        return;
      }
      indexRef.current = step.index;
      commandedIndex.current = step.index;
      commandAt.current = Date.now();
      positionHold.current = 0;
      setIndex(step.index);
      publishProgress(0);
      resumeAllowedFor.current = null;
      pendingResumeFileId.current = null;
      const wasPlaying = live.playing;
      live.skipTo(step.index);
      live.playbackRate = rateRef.current;
      const previousWrapped = direction === "previous" && before === 0;
      if (wasPlaying || previousWrapped) {
        expectingPlayback.current = true;
        live.play();
      }
    },
    [publishProgress],
  );

  const next = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void persistPosition(true);
    commitStep("next");
  }, [commitStep, persistPosition]);

  const previous = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void persistPosition(true);
    commitStep("previous");
  }, [commitStep, persistPosition]);

  const skipBy = useCallback(
    (deltaSec: number) => {
      const live = playlistRef.current;
      const duration = live.currentStatus.duration;
      const nextPos = clampSkipPosition(positionRef.current, deltaSec, duration);
      positionRef.current = nextPos;
      positionHold.current = nextPos;
      publishProgress(nextPos);
      void live.seekTo(nextPos);
    },
    [publishProgress],
  );

  const seekTo = useCallback(
    async (seconds: number) => {
      const live = playlistRef.current;
      const nextPos = Math.max(0, seconds);
      positionRef.current = nextPos;
      positionHold.current = nextPos;
      publishProgress(nextPos);
      if (!aliveRef.current || playlistRef.current !== live) return;
      try {
        await live.seekTo(nextPos);
      } catch {
        // Seek can settle after the playlist has been released.
      }
    },
    [publishProgress],
  );

  const setRate = useCallback((nextRate: number) => {
    rateRef.current = nextRate;
    setRateState(nextRate);
    playlistRef.current.playbackRate = nextRate;
    void savePlaybackRate(nextRate);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const value = nextRepeat(prev);
      repeatRef.current = value;
      playlistRef.current.loop = repeatToLoopMode(value);
      void saveRepeatMode(value);
      return value;
    });
  }, []);

  const cycleSpeed = useCallback(() => {
    setRateState((prev) => {
      const value = nextSpeed(prev);
      rateRef.current = value;
      playlistRef.current.playbackRate = value;
      void savePlaybackRate(value);
      return value;
    });
  }, []);

  const openFullPlayer = useCallback(() => {
    router.push("/player");
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Track change: clear finished-track resume, lock metadata, seek 0 unless user-start resume.
  useEffect(() => {
    const sub = playlist.addListener("trackChanged", ({ previousIndex, currentIndex }) => {
      if (rebuildingRef.current) {
        if (commandedIndex.current == null) indexRef.current = currentIndex;
        return;
      }
      if (commandedIndex.current != null && currentIndex !== commandedIndex.current) {
        return;
      }
      if (currentIndex !== indexRef.current && Date.now() - commandAt.current < 800) {
        return;
      }
      commandedIndex.current = null;

      const prevFromRef = indexRef.current;
      const prevIndex = previousIndex >= 0 ? previousIndex : prevFromRef;
      const prevItem = queueRef.current[prevIndex];
      if (prevItem && prevIndex !== currentIndex) {
        const snap = lastPosByFileRef.current[prevItem.fileId];
        if (snap && isNearEnd(snap.time, snap.duration)) {
          void clearResumePosition(prevItem.fileId);
        }
      }

      const item = queueRef.current[currentIndex];
      indexRef.current = currentIndex;
      setIndex((prev) => (prev === currentIndex ? prev : currentIndex));
      if (!item) return;
      lockMetadata(item);
      playlist.playbackRate = rateRef.current;

      const allowResume =
        shouldApplyResume("user-start") && resumeAllowedFor.current === item.fileId;

      if (allowResume) {
        pendingResumeFileId.current = item.fileId;
        setResumeToken((value) => value + 1);
      } else {
        pendingResumeFileId.current = null;
        resumeAllowedFor.current = null;
        positionRef.current = 0;
        positionHold.current = 0;
        void playlist.seekTo(0);
      }
    });
    return () => sub.remove();
  }, [lockMetadata, playlist]);

  const current = queue[index] ?? null;
  const currentFileId = current?.fileId ?? null;

  const api = useMemo<PlayerApi>(
    () => ({
      queue,
      current,
      index,
      isPlaying,
      rate,
      repeat,
      toast,
      playQueue,
      playIndex,
      toggle,
      pause,
      next,
      previous,
      skipBy,
      seekTo,
      setRate,
      cycleRepeat,
      cycleSpeed,
      openFullPlayer,
      dismissToast,
      isRecordingOverlay,
      setRecordingOverlay,
    }),
    [
      queue,
      current,
      currentFileId,
      index,
      isPlaying,
      rate,
      repeat,
      toast,
      playQueue,
      playIndex,
      toggle,
      pause,
      next,
      previous,
      skipBy,
      seekTo,
      setRate,
      cycleRepeat,
      cycleSpeed,
      openFullPlayer,
      dismissToast,
      isRecordingOverlay,
    ],
  );

  return (
    <PlayerContext.Provider value={api}>
      <PlayerProgressContext.Provider value={progress}>
        <View style={{ flex: 1 }}>
          {children}
          <PlayerStatusSync playlist={playlist} runtime={runtime} resumeToken={resumeToken} />
          <MiniPlayer />
          {toast ? <ResumeToast message={toast} /> : null}
        </View>
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

function PlayerStatusSync({
  playlist,
  runtime,
  resumeToken,
}: {
  playlist: AudioPlaylist;
  runtime: PlayerRuntime;
  resumeToken: number;
}) {
  const status = useAudioPlaylistStatus(playlist);

  useEffect(() => {
    const item = runtime.queueRef.current[status.currentIndex];
    if (!item) return;
    runtime.lastPosByFileRef.current[item.fileId] = {
      time: status.currentTime,
      duration: status.duration,
    };
  }, [runtime, status.currentIndex, status.currentTime, status.duration]);

  useEffect(() => {
    // While a burst of skipTo calls is in flight, the ref is the source of truth.
    if (runtime.commandedIndex.current == null) {
      runtime.indexRef.current = status.currentIndex;
      runtime.setIndex((prev) => (prev === status.currentIndex ? prev : status.currentIndex));
    } else if (status.currentIndex === runtime.commandedIndex.current) {
      runtime.commandedIndex.current = null;
    }

    const hold = runtime.positionHold.current;
    if (hold != null && Math.abs(status.currentTime - hold) <= 0.5) {
      runtime.positionHold.current = null;
    }
    runtime.positionRef.current =
      runtime.positionHold.current != null ? runtime.positionHold.current : status.currentTime;
    runtime.setIsPlaying((prev) => (prev === status.playing ? prev : status.playing));
    runtime.progress.publish({
      position: runtime.positionRef.current,
      duration: status.duration,
      isBuffering: status.isBuffering,
    });
  }, [
    runtime,
    status.currentIndex,
    status.currentTime,
    status.duration,
    status.isBuffering,
    status.playing,
  ]);

  useEffect(() => {
    if (!status.playing) return;
    const item = runtime.queueRef.current[runtime.indexRef.current];
    if (!item) return;
    const now = Date.now();
    if (now - runtime.lastPersistAt.current < 5000) return;
    runtime.lastPersistAt.current = now;
    const pos = runtime.positionRef.current;
    if (!shouldPersistResume(pos, status.duration)) return;
    void saveResumePosition(item.fileId, pos);
  }, [runtime, status.currentTime, status.duration, status.playing]);

  useEffect(() => {
    const lastIndex = runtime.queueRef.current.length - 1;
    const onLast = lastIndex >= 0 && status.currentIndex === lastIndex;
    if (!status.didJustFinish || runtime.repeatRef.current !== "all" || !onLast) {
      if (!status.didJustFinish) runtime.wrapGuard.current = false;
      return;
    }
    if (runtime.wrapGuard.current) return;
    runtime.wrapGuard.current = true;
    runtime.resumeAllowedFor.current = null;
    runtime.pendingResumeFileId.current = null;
    runtime.commandedIndex.current = 0;
    runtime.commandAt.current = Date.now();
    runtime.indexRef.current = 0;
    runtime.positionRef.current = 0;
    runtime.positionHold.current = 0;
    runtime.setIndex(0);
    playlist.skipTo(0);
    playlist.playbackRate = runtime.rateRef.current;
    runtime.expectingPlayback.current = true;
    playlist.play();
  }, [playlist, runtime, status.currentIndex, status.didJustFinish]);

  useEffect(() => {
    const ready = status.isLoaded || status.duration > 0 || status.playing;
    if (!ready) return;
    if (runtime.applyingResume.current) return;
    const item = runtime.queueRef.current[status.currentIndex];
    if (!item) return;
    if (runtime.pendingResumeFileId.current !== item.fileId) return;
    if (runtime.resumeAllowedFor.current !== item.fileId) return;
    void applyResume(playlist, runtime, item, status.duration);
  }, [
    playlist,
    resumeToken,
    runtime,
    status.currentIndex,
    status.currentTime,
    status.duration,
    status.isLoaded,
    status.playing,
  ]);

  useEffect(() => {
    if (status.playing || status.isLoaded) {
      runtime.expectingPlayback.current = false;
      return;
    }
    if (!runtime.expectingPlayback.current) return;
    if (status.isBuffering) return;
    const item = runtime.queueRef.current[status.currentIndex];
    if (!item) return;
    if (runtime.retriedFileId.current === item.fileId) return;
    const timer = setTimeout(() => {
      void retryCurrentUrl(playlist, runtime, status.currentIndex);
    }, 1200);
    return () => clearTimeout(timer);
  }, [playlist, runtime, status.currentIndex, status.isBuffering, status.isLoaded, status.playing]);

  return null;
}

async function applyResume(
  playlist: AudioPlaylist,
  runtime: PlayerRuntime,
  item: PlayerQueueItem,
  statusDuration: number,
) {
  if (!shouldApplyResume("user-start")) return;
  if (runtime.resumeAllowedFor.current !== item.fileId) return;
  if (runtime.resumedFileIds.current.has(item.fileId)) return;
  const saved = await loadResumePosition(item.fileId);
  if (!runtime.aliveRef.current || runtime.playlistRef.current !== playlist) return;
  const durationSec =
    item.durationMs && item.durationMs > 0
      ? item.durationMs / 1000
      : statusDuration > 0
        ? statusDuration
        : 0;
  if (!shouldResume(saved, durationSec)) {
    runtime.pendingResumeFileId.current = null;
    runtime.resumeAllowedFor.current = null;
    return;
  }
  runtime.applyingResume.current = true;
  try {
    runtime.setToast(copy.content.resumedAt(formatClock(saved)));
    await playlist.seekTo(saved);
    if (!runtime.aliveRef.current || runtime.playlistRef.current !== playlist) return;
    runtime.positionRef.current = saved;
    runtime.positionHold.current = saved;
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!runtime.aliveRef.current || runtime.playlistRef.current !== playlist) return;
    const pos = playlist.currentTime;
    if (pos > 0 && Math.abs(pos - saved) > 4) {
      return;
    }
    runtime.resumedFileIds.current.add(item.fileId);
    runtime.pendingResumeFileId.current = null;
    runtime.resumeAllowedFor.current = null;
  } catch {
    // Track may not be seekable yet; keep pending for a later attempt.
  } finally {
    runtime.applyingResume.current = false;
  }
}

async function retryCurrentUrl(playlist: AudioPlaylist, runtime: PlayerRuntime, index: number) {
  const item = runtime.queueRef.current[index];
  if (!item) return;
  if (runtime.retriedFileId.current === item.fileId) return;
  runtime.retriedFileId.current = item.fileId;
  try {
    const { url } = await getApiClient().getFileUrl(item.fileId, false);
    if (!runtime.aliveRef.current || runtime.playlistRef.current !== playlist) return;
    const nextQueue = runtime.queueRef.current.map((entry, i) =>
      i === index ? { ...entry, url } : entry,
    );
    runtime.queueRef.current = nextQueue;
    runtime.setQueue(nextQueue);
    playlist.remove(index);
    playlist.insert({ uri: url, name: item.displayName }, index);
    playlist.skipTo(index);
    playlist.playbackRate = runtime.rateRef.current;
    runtime.expectingPlayback.current = true;
    playlist.play();
    playlist.setActiveForLockScreen(
      true,
      {
        title: item.displayName,
        artist: item.groupDisplayName,
        albumTitle: albumTitleFor(item),
      },
      {
        showNextTrack: true,
        showPreviousTrack: true,
        showSeekForward: true,
        showSeekBackward: true,
        seekForwardIntervalSeconds: 10,
        seekBackwardIntervalSeconds: 10,
      },
    );
  } catch {
    runtime.expectingPlayback.current = false;
  }
}

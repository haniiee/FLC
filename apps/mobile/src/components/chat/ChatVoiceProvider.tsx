import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { getApiClient } from "../../lib/api";
import { cacheVoiceUrl, isVoiceUrlFresh, type CachedVoiceUrl } from "../../lib/chat-voice";
import { usePlayerOptional } from "../../player/context";

type ChatVoiceApi = {
  activeId: string | null;
  playing: boolean;
  toggle: (messageId: string) => void;
  seek: (messageId: string, ratio: number) => void;
  pause: () => void;
};

type ChatVoiceProgress = {
  currentTime: number;
  duration: number;
};

type ProgressStore = {
  getSnapshot: () => ChatVoiceProgress;
  subscribe: (listener: () => void) => () => void;
  publish: (next: ChatVoiceProgress) => void;
};

const EMPTY_PROGRESS: ChatVoiceProgress = { currentTime: 0, duration: 0 };

function createProgressStore(): ProgressStore {
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
      if (current.currentTime === next.currentTime && current.duration === next.duration) return;
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

const ChatVoiceContext = createContext<ChatVoiceApi | null>(null);
const ChatVoiceProgressContext = createContext<ProgressStore | null>(null);

type ContentControls = { pause: () => void; isPlaying: boolean };

export function ChatVoiceProvider({ children }: { children: ReactNode }) {
  const contentRef = useRef<ContentControls | null>(null);
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  const scrubRef = useRef<number | null>(null);
  const generation = useRef(0);
  const retried = useRef(new Set<string>());
  const cacheRef = useRef(new Map<string, CachedVoiceUrl>());
  const inflightRef = useRef(new Map<string, Promise<string>>());
  const progress = useMemo(() => createProgressStore(), []);

  const urlFor = useCallback(async (id: string, force = false) => {
    const cached = cacheRef.current.get(id);
    if (!force && isVoiceUrlFresh(cached, Date.now()) && cached) return cached.url;
    if (!force) {
      const pending = inflightRef.current.get(id);
      if (pending) return pending;
    }
    const task = getApiClient()
      .getChatMessageUrl(id)
      .then((response) => {
        const entry = cacheVoiceUrl(response.url, response.expiresIn, Date.now());
        cacheRef.current.set(id, entry);
        return entry.url;
      })
      .finally(() => {
        inflightRef.current.delete(id);
      });
    inflightRef.current.set(id, task);
    return task;
  }, []);

  useEffect(() => {
    return () => {
      try {
        player.pause();
        player.remove();
      } catch {
        // The screen is already gone.
      }
    };
  }, [player]);

  const toggle = useCallback(
    (messageId: string) => {
      if (activeIdRef.current === messageId && player.playing) {
        player.pause();
        return;
      }
      if (contentRef.current?.isPlaying) contentRef.current.pause();
      if (activeIdRef.current === messageId) {
        player.play();
        return;
      }
      const gen = ++generation.current;
      player.pause();
      scrubRef.current = null;
      activeIdRef.current = messageId;
      setActiveId(messageId);
      retried.current.delete(messageId);
      void urlFor(messageId)
        .then((url) => {
          if (generation.current !== gen) return;
          player.replace({ uri: url });
          player.play();
        })
        .catch(() => {
          if (generation.current !== gen) return;
          player.pause();
        });
    },
    [player, urlFor],
  );

  const seek = useCallback(
    (messageId: string, ratio: number) => {
      if (activeIdRef.current !== messageId) return;
      const duration = player.duration > 0 ? player.duration : progress.getSnapshot().duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const next = Math.max(0, Math.min(1, ratio)) * duration;
      scrubRef.current = next;
      progress.publish({ currentTime: next, duration });
      void player.seekTo(next);
    },
    [player, progress],
  );

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const setPlayingIfChanged = useCallback((next: boolean) => {
    setPlaying((prev) => (prev === next ? prev : next));
  }, []);

  const value = useMemo<ChatVoiceApi>(
    () => ({
      activeId,
      playing,
      toggle,
      seek,
      pause,
    }),
    [activeId, pause, playing, seek, toggle],
  );

  return (
    <ChatVoiceContext.Provider value={value}>
      <ChatVoiceProgressContext.Provider value={progress}>
        <ContentPauseBridge target={contentRef} />
        <ChatVoiceTicker
          player={player}
          progress={progress}
          scrubRef={scrubRef}
          activeIdRef={activeIdRef}
          generation={generation}
          retried={retried}
          urlFor={urlFor}
          onPlaying={setPlayingIfChanged}
        />
        {children}
      </ChatVoiceProgressContext.Provider>
    </ChatVoiceContext.Provider>
  );
}

function ContentPauseBridge({ target }: { target: MutableRefObject<ContentControls | null> }) {
  const content = usePlayerOptional();
  target.current = content ? { pause: content.pause, isPlaying: content.isPlaying } : null;
  return null;
}

function ChatVoiceTicker({
  player,
  progress,
  scrubRef,
  activeIdRef,
  generation,
  retried,
  urlFor,
  onPlaying,
}: {
  player: AudioPlayer;
  progress: ProgressStore;
  scrubRef: MutableRefObject<number | null>;
  activeIdRef: MutableRefObject<string | null>;
  generation: MutableRefObject<number>;
  retried: MutableRefObject<Set<string>>;
  urlFor: (id: string, force?: boolean) => Promise<string>;
  onPlaying: (playing: boolean) => void;
}) {
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    onPlaying(status.playing);
  }, [onPlaying, status.playing]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    scrubRef.current = null;
    player.pause();
    void player.seekTo(0);
    progress.publish({ currentTime: 0, duration: status.duration });
  }, [player, progress, scrubRef, status.didJustFinish, status.duration]);

  useEffect(() => {
    const scrub = scrubRef.current;
    let currentTime = status.didJustFinish ? 0 : status.currentTime;
    if (scrub != null) {
      if (Math.abs(status.currentTime - scrub) <= 0.5) scrubRef.current = null;
      else currentTime = scrub;
    }
    progress.publish({ currentTime, duration: status.duration });
  }, [progress, scrubRef, status.currentTime, status.didJustFinish, status.duration]);

  useEffect(() => {
    const id = activeIdRef.current;
    if (!status.error || !id || retried.current.has(id)) return;
    retried.current.add(id);
    const gen = generation.current;
    void (async () => {
      try {
        const url = await urlFor(id, true);
        if (generation.current !== gen || activeIdRef.current !== id) return;
        player.replace({ uri: url });
        player.play();
      } catch {
        player.pause();
      }
    })();
  }, [activeIdRef, generation, player, retried, status.error, urlFor]);

  return null;
}

export function useChatVoice(): ChatVoiceApi {
  const ctx = useContext(ChatVoiceContext);
  if (!ctx) throw new Error("useChatVoice must be used within ChatVoiceProvider");
  return ctx;
}

export function useChatVoiceOptional(): ChatVoiceApi | null {
  return useContext(ChatVoiceContext);
}

/** Live clock for the voice that is currently loaded. */
export function useChatVoiceProgress(): ChatVoiceProgress {
  const store = useContext(ChatVoiceProgressContext);
  if (!store) throw new Error("useChatVoiceProgress must be used within ChatVoiceProvider");
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

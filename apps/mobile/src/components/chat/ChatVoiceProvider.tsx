import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getApiClient } from "../../lib/api";
import { cacheVoiceUrl, isVoiceUrlFresh, type CachedVoiceUrl } from "../../lib/chat-voice";
import { usePlayerOptional } from "../../player/context";

type ChatVoiceApi = {
  activeId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  toggle: (messageId: string) => void;
  seek: (messageId: string, ratio: number) => void;
  pause: () => void;
};

const ChatVoiceContext = createContext<ChatVoiceApi | null>(null);

export function ChatVoiceProvider({ children }: { children: ReactNode }) {
  const contentPlayer = usePlayerOptional();
  const contentRef = useRef(contentPlayer);
  contentRef.current = contentPlayer;
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Seconds applied in the same turn as a seek, before the next status event. */
  const [scrubSec, setScrubSec] = useState<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const generation = useRef(0);
  const retried = useRef(new Set<string>());
  const cacheRef = useRef(new Map<string, CachedVoiceUrl>());
  const inflightRef = useRef(new Map<string, Promise<string>>());

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

  useEffect(() => {
    if (!status.didJustFinish) return;
    setScrubSec(null);
    player.pause();
    void player.seekTo(0);
  }, [player, status.didJustFinish]);

  useEffect(() => {
    if (scrubSec == null) return;
    if (Math.abs(status.currentTime - scrubSec) <= 0.5) setScrubSec(null);
  }, [scrubSec, status.currentTime]);

  useEffect(() => {
    if (scrubSec == null) return;
    const timer = setTimeout(() => setScrubSec(null), 400);
    return () => clearTimeout(timer);
  }, [scrubSec]);

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
  }, [player, status.error, urlFor]);

  const toggle = useCallback(
    (messageId: string) => {
      if (activeIdRef.current === messageId && player.playing) {
        player.pause();
        return;
      }
      contentRef.current?.pause();
      if (activeIdRef.current === messageId) {
        player.play();
        return;
      }
      const gen = ++generation.current;
      player.pause();
      setScrubSec(null);
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
      const duration = player.duration > 0 ? player.duration : status.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const next = Math.max(0, Math.min(1, ratio)) * duration;
      setScrubSec(next);
      void player.seekTo(next);
    },
    [player, status.duration],
  );

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const currentTime = status.didJustFinish ? 0 : (scrubSec ?? status.currentTime);
  const value = useMemo<ChatVoiceApi>(
    () => ({
      activeId,
      playing: status.playing,
      currentTime,
      duration: status.duration,
      toggle,
      seek,
      pause,
    }),
    [activeId, currentTime, pause, seek, status.duration, status.playing, toggle],
  );

  return <ChatVoiceContext.Provider value={value}>{children}</ChatVoiceContext.Provider>;
}

export function useChatVoice(): ChatVoiceApi {
  const ctx = useContext(ChatVoiceContext);
  if (!ctx) throw new Error("useChatVoice must be used within ChatVoiceProvider");
  return ctx;
}

export function useChatVoiceOptional(): ChatVoiceApi | null {
  return useContext(ChatVoiceContext);
}

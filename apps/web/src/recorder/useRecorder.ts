"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlayer } from "../player/context";
import {
  cancelHint,
  initialGestureState,
  reduceGesture,
  type Dir,
  type GestureEvent,
  type GestureState,
} from "./gesture";
import { baseMimeType, pickRecordingMime } from "./pick-mime";

function readDir(): Dir {
  if (typeof document === "undefined") {
    return "rtl";
  }
  return document.documentElement.dir === "ltr" ? "ltr" : "rtl";
}

function stopTracks(stream: MediaStream | null) {
  if (!stream) {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export type RecorderResult = {
  blob: Blob;
  mimeType: string;
  baseMime: string;
};

export function useRecorder() {
  const player = usePlayer();
  const [gesture, setGesture] = useState<GestureState>(initialGestureState);
  const gestureRef = useRef(gesture);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const handlersRef = useRef<{ onSend: (result: RecorderResult) => void | Promise<void> }>({
    onSend: async () => undefined,
  });
  const dispatchRef = useRef<(event: GestureEvent) => void>(() => undefined);

  useEffect(() => {
    gestureRef.current = gesture;
  }, [gesture]);

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    clearTick();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    stopTracks(streamRef.current);
    streamRef.current = null;
    chunksRef.current = [];
  }, [clearTick]);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  const stopRecorder = useCallback((): Promise<RecorderResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      const mime = mimeRef.current;
      clearTick();
      if (!recorder || recorder.state === "inactive") {
        stopTracks(streamRef.current);
        streamRef.current = null;
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const parts = chunksRef.current.slice();
        chunksRef.current = [];
        stopTracks(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        if (!mime || parts.length === 0) {
          resolve(null);
          return;
        }
        resolve({
          blob: new Blob(parts, { type: baseMimeType(mime) }),
          mimeType: mime,
          baseMime: baseMimeType(mime),
        });
      };
      try {
        recorder.stop();
      } catch {
        stopTracks(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        resolve(null);
      }
    });
  }, [clearTick]);

  const startMedia = useCallback(async () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error("ضبط فقط روی https یا localhost کار می‌کند");
      return false;
    }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("این مرورگر از ضبط پشتیبانی نمی‌کند");
      return false;
    }
    const mime = pickRecordingMime((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) {
      toast.error("فرمت ضبط روی این دستگاه پشتیبانی نمی‌شود");
      return false;
    }

    player.pause();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    mimeRef.current = mime;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.start(250);
    clearTick();
    tickRef.current = window.setInterval(() => {
      dispatchRef.current({ type: "tick", now: Date.now() });
    }, 200);
    return true;
  }, [clearTick, player]);

  const dispatch = useCallback(
    (event: GestureEvent) => {
      const reduced = reduceGesture(gestureRef.current, event);
      gestureRef.current = reduced.state;
      setGesture(reduced.state);
      if (!reduced.effects.length) {
        return;
      }
      void (async () => {
        for (const effect of reduced.effects) {
          switch (effect.type) {
            case "toast":
              toast.message(effect.message);
              break;
            case "vibrate":
              try {
                navigator.vibrate?.(10);
              } catch {
                // ignore
              }
              break;
            case "request-permission": {
              try {
                if (!window.isSecureContext) {
                  toast.error("ضبط فقط روی https یا localhost کار می‌کند");
                  dispatchRef.current({ type: "permission-denied" });
                  break;
                }
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: { echoCancellation: true, noiseSuppression: true },
                });
                stopTracks(stream);
                dispatchRef.current({ type: "permission-granted" });
              } catch {
                dispatchRef.current({ type: "permission-denied" });
              }
              break;
            }
            case "start-recording": {
              try {
                const ok = await startMedia();
                if (!ok) {
                  const next: GestureState = {
                    ...gestureRef.current,
                    ui: "idle",
                    startedAt: null,
                    elapsedMs: 0,
                    startX: null,
                  };
                  gestureRef.current = next;
                  setGesture(next);
                }
              } catch {
                toast.error("دسترسی میکروفن لازم است");
                cleanupMedia();
                const next: GestureState = {
                  ...gestureRef.current,
                  ui: "idle",
                  hasPermission: false,
                  startedAt: null,
                  elapsedMs: 0,
                  startX: null,
                };
                gestureRef.current = next;
                setGesture(next);
              }
              break;
            }
            case "stop-and-discard": {
              await stopRecorder();
              cleanupMedia();
              break;
            }
            case "stop-and-send": {
              const result = await stopRecorder();
              cleanupMedia();
              if (result && result.blob.size > 0) {
                await handlersRef.current.onSend(result);
              }
              dispatchRef.current({ type: "send-finished" });
              break;
            }
            default:
              break;
          }
        }
      })();
    },
    [cleanupMedia, startMedia, stopRecorder],
  );

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  const setOnSend = useCallback((fn: (result: RecorderResult) => void | Promise<void>) => {
    handlersRef.current.onSend = fn;
  }, []);

  const onPress = useCallback(
    (x: number) => dispatch({ type: "press", x, now: Date.now() }),
    [dispatch],
  );
  const onMove = useCallback(
    (x: number) => dispatch({ type: "move", x, dir: readDir() }),
    [dispatch],
  );
  const onRelease = useCallback(() => dispatch({ type: "release", now: Date.now() }), [dispatch]);

  return {
    gesture,
    dir: readDir(),
    cancelHintText: cancelHint(readDir()),
    setOnSend,
    onPress,
    onMove,
    onRelease,
  };
}

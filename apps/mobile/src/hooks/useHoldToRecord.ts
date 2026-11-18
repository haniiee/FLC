import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { decideVoiceHold } from "../lib/chat-voice";
import { copy } from "../lib/copy";
import { enableRecordingAudioMode, restorePlaybackAudioMode } from "../lib/playback-audio-mode";
import {
  MAX_RECORD_MS,
  clampMaxDuration,
  decideRecordingStart,
  isCancelGesture,
  meteringToLevel,
  resolveStartOutcome,
} from "../lib/record-logic";
import type { VoiceCapture } from "../lib/upload-voice";
import { deleteLocalCapture } from "../lib/upload-voice";
import { usePlayerOptional } from "../player/context";

const LONG_PRESS_MS = 180;
const RECORD_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

type UseHoldToRecordOptions = {
  onCaptured: (capture: VoiceCapture) => void;
  disabled?: boolean;
  /** Defaults to the 10-minute topic ceiling. Chat passes five minutes. */
  maxDurationMs?: number;
  /** Runs beside the content-player pause, before the microphone opens. */
  onBeforeRecord?: () => void;
};

/**
 * Hold-to-record core shared by topic voice and chat voice.
 * Gesture ids, the recorder op chain, release-on-abort, and the short-hold
 * toast stay here so both callers keep one behavior.
 */
export function useHoldToRecord({
  onCaptured,
  disabled,
  maxDurationMs = MAX_RECORD_MS,
  onBeforeRecord,
}: UseHoldToRecordOptions) {
  const limitMs = clampMaxDuration(maxDurationMs);
  const player = usePlayerOptional();

  const [uiRecording, setUiRecording] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeRef = useRef(false);
  const finishingRef = useRef(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const suppressFinishedRef = useRef(false);
  const opChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const gestureIdRef = useRef(0);
  const releasedIdRef = useRef(0);
  const activeGestureIdRef = useRef<number | null>(null);
  const uiGestureIdRef = useRef<number | null>(null);
  const uiRecordingRef = useRef(false);
  const micGrantedRef = useRef<boolean | null>(null);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;
  const onBeforeRecordRef = useRef(onBeforeRecord);
  onBeforeRecordRef.current = onBeforeRecord;
  const finishRef = useRef<(cancel: boolean) => Promise<void>>(async () => undefined);
  const stoppingDepthRef = useRef(0);

  const dragX = useSharedValue(0);
  const startAbsX = useSharedValue(0);
  const pulse = useSharedValue(1);
  const chevronX = useSharedValue(0);

  const recorder = useAudioRecorder(RECORD_OPTIONS, (status) => {
    if (
      status.isFinished &&
      !suppressFinishedRef.current &&
      activeRef.current &&
      uiRecordingRef.current &&
      !finishingRef.current
    ) {
      void finishRef.current(false);
    }
  });
  const recState = useAudioRecorderState(recorder, 100);

  useEffect(() => {
    if (!uiRecording) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.35, { duration: 520 }), withTiming(1, { duration: 520 })),
      -1,
      false,
    );
  }, [pulse, uiRecording]);

  useEffect(() => {
    if (!uiRecording || cancelArmed) {
      cancelAnimation(chevronX);
      chevronX.value = 0;
      return;
    }
    chevronX.value = withRepeat(
      withSequence(withTiming(-8, { duration: 480 }), withTiming(0, { duration: 480 })),
      -1,
      false,
    );
  }, [cancelArmed, chevronX, uiRecording]);

  useEffect(() => {
    player?.setRecordingOverlay(uiRecording);
    return () => {
      player?.setRecordingOverlay(false);
    };
  }, [player, uiRecording]);

  useEffect(() => {
    void getRecordingPermissionsAsync()
      .then((permission) => {
        micGrantedRef.current = permission.granted;
      })
      .catch(() => {
        micGrantedRef.current = null;
      });
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 1800);
  }, []);

  const showHoldToast = useCallback(() => {
    showToast(copy.content.holdToRecord);
  }, [showToast]);

  const enqueue = useCallback(<T>(operation: () => Promise<T> | T): Promise<T> => {
    const run = opChainRef.current.then(operation, operation);
    opChainRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const clearRecordingState = useCallback(() => {
    activeRef.current = false;
    activeGestureIdRef.current = null;
    uiGestureIdRef.current = null;
    uiRecordingRef.current = false;
    setUiRecording(false);
    setCancelArmed(false);
    dragX.value = 0;
  }, [dragX]);

  const markStopping = useCallback(() => {
    stoppingDepthRef.current += 1;
    stoppingRef.current = true;
  }, []);
  const unmarkStopping = useCallback(() => {
    stoppingDepthRef.current = Math.max(0, stoppingDepthRef.current - 1);
    stoppingRef.current = stoppingDepthRef.current > 0;
  }, []);

  const releaseRecorder = useCallback(async () => {
    markStopping();
    try {
      const uri = await enqueue(async () => {
        suppressFinishedRef.current = true;
        try {
          await recorder.stop();
        } catch {
          // stop() throws if record() never started; native code still releases.
        }
        const captured = recorder.uri;
        try {
          await restorePlaybackAudioMode();
        } catch {
          // Playback mode restore is best-effort.
        }
        return captured;
      });
      if (uri) await deleteLocalCapture(uri);
    } finally {
      unmarkStopping();
    }
  }, [enqueue, markStopping, recorder, unmarkStopping]);

  const restoreAudioMode = useCallback(async () => {
    markStopping();
    try {
      await enqueue(async () => {
        try {
          await restorePlaybackAudioMode();
        } catch {
          // Playback mode restore is best-effort.
        }
      });
    } finally {
      unmarkStopping();
    }
  }, [enqueue, markStopping, unmarkStopping]);

  const finishRecording = useCallback(
    async (cancel: boolean) => {
      const id = activeGestureIdRef.current;
      if (!activeRef.current || finishingRef.current) return;
      if (
        !uiRecordingRef.current ||
        uiGestureIdRef.current == null ||
        uiGestureIdRef.current !== id
      ) {
        return;
      }
      finishingRef.current = true;
      markStopping();
      clearRecordingState();

      try {
        const { uri, durationMs } = await enqueue(async () => {
          let durationMs = 0;
          let uri: string | null = null;
          try {
            durationMs = Math.min(clampMaxDuration(recorder.getStatus().durationMillis), limitMs);
            suppressFinishedRef.current = true;
            await recorder.stop();
            uri = recorder.uri;
          } catch {
            uri = recorder.uri;
          }
          try {
            await restorePlaybackAudioMode();
          } catch {
            // Playback mode restore is best-effort.
          }
          return { uri, durationMs };
        });

        const decision = decideVoiceHold({
          cancelled: cancel,
          durationMs,
          hasFile: Boolean(uri),
        });
        if (decision === "cancel") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (uri) await deleteLocalCapture(uri);
          return;
        }
        if (decision === "discard") {
          showHoldToast();
          if (uri) await deleteLocalCapture(uri);
          return;
        }

        onCapturedRef.current({
          uri: uri ?? "",
          durationMs,
          mimeType: "audio/mp4",
          fileName: "recording.m4a",
        });
      } finally {
        unmarkStopping();
        finishingRef.current = false;
      }
    },
    [clearRecordingState, enqueue, limitMs, markStopping, recorder, showHoldToast, unmarkStopping],
  );

  finishRef.current = finishRecording;

  const abortStartedRecording = useCallback(async () => {
    clearRecordingState();
    await releaseRecorder();
    showHoldToast();
  }, [clearRecordingState, releaseRecorder, showHoldToast]);

  const beginRecording = useCallback(
    async (id: number) => {
      if (
        disabled ||
        decideRecordingStart({
          starting: startingRef.current,
          stopping: stoppingRef.current,
          active: activeRef.current,
          finishing: finishingRef.current,
        }) !== "start"
      ) {
        return;
      }
      startingRef.current = true;
      let audioMode = false;
      let prepared = false;

      const abortIfStale = async (started: boolean): Promise<boolean> => {
        const outcome = resolveStartOutcome({
          gestureId: id,
          currentGestureId: gestureIdRef.current,
          releasedId: releasedIdRef.current,
          started,
        });
        if (outcome === "continue") return false;
        if (started) {
          await abortStartedRecording();
        } else if (prepared) {
          clearRecordingState();
          await releaseRecorder();
        } else if (audioMode) {
          await restoreAudioMode();
        }
        return true;
      };

      try {
        if (micGrantedRef.current !== true) {
          const permission = await requestRecordingPermissionsAsync();
          micGrantedRef.current = permission.granted;
          if (!permission.granted) {
            Alert.alert(copy.content.micPermissionTitle, copy.content.micPermissionMessage, [
              { text: copy.content.cancel, style: "cancel" },
              {
                text: copy.content.openSettings,
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ]);
            return;
          }
          if (await abortIfStale(false)) return;
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        player?.pause();
        onBeforeRecordRef.current?.();
        await enqueue(() => enableRecordingAudioMode());
        audioMode = true;
        if (await abortIfStale(false)) return;

        await enqueue(() => recorder.prepareToRecordAsync());
        prepared = true;
        if (await abortIfStale(false)) return;

        await enqueue(async () => {
          recorder.record({ forDuration: limitMs / 1000 });
        });
        activeRef.current = true;
        activeGestureIdRef.current = id;

        if (await abortIfStale(true)) return;

        uiGestureIdRef.current = id;
        uiRecordingRef.current = true;
        suppressFinishedRef.current = false;
        setUiRecording(true);
        setCancelArmed(false);
        dragX.value = 0;
      } catch {
        startingRef.current = false;
        clearRecordingState();
        try {
          await releaseRecorder();
        } catch {
          stoppingDepthRef.current = 0;
          stoppingRef.current = false;
        }
        const outcome = resolveStartOutcome({
          gestureId: id,
          currentGestureId: gestureIdRef.current,
          releasedId: releasedIdRef.current,
          started: false,
        });
        if (outcome === "continue") {
          showToast(copy.content.recordStartFailed);
        }
      } finally {
        startingRef.current = false;
      }
    },
    [
      abortStartedRecording,
      clearRecordingState,
      disabled,
      dragX,
      enqueue,
      limitMs,
      player,
      recorder,
      releaseRecorder,
      restoreAudioMode,
      showToast,
    ],
  );

  useEffect(() => {
    if (!uiRecording || !activeRef.current) return;
    if (recState.durationMillis >= limitMs) {
      void finishRecording(false);
    }
  }, [finishRecording, limitMs, recState.durationMillis, uiRecording]);

  const onPanStart = useCallback(() => {
    const decision = decideRecordingStart({
      starting: startingRef.current,
      stopping: stoppingRef.current,
      active: activeRef.current,
      finishing: finishingRef.current,
    });
    if (decision === "toast") {
      showHoldToast();
      return;
    }
    if (decision === "ignore") {
      if (startingRef.current) {
        releasedIdRef.current = gestureIdRef.current;
      }
      return;
    }
    const id = ++gestureIdRef.current;
    void beginRecording(id);
  }, [beginRecording, showHoldToast]);

  const onPanUpdate = useCallback((screenDx: number) => {
    const armed = isCancelGesture(screenDx);
    setCancelArmed((prev) => {
      if (armed && !prev) {
        void Haptics.selectionAsync();
      }
      return armed;
    });
  }, []);

  const onPanEnd = useCallback(
    (screenDx: number) => {
      releasedIdRef.current = gestureIdRef.current;
      if (!activeRef.current) return;
      void finishRecording(isCancelGesture(screenDx));
    },
    [finishRecording],
  );

  const onPanCancel = useCallback(() => {
    releasedIdRef.current = gestureIdRef.current;
    if (!activeRef.current) return;
    void finishRecording(true);
  }, [finishRecording]);

  const onShortTap = useCallback(() => {
    showHoldToast();
  }, [showHoldToast]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .enabled(!disabled)
    .onStart((event) => {
      startAbsX.value = event.absoluteX;
      dragX.value = 0;
      runOnJS(onPanStart)();
    })
    .onUpdate((event) => {
      const absDx = event.absoluteX - startAbsX.value;
      const screenDx = Math.min(event.translationX, absDx);
      dragX.value = screenDx;
      runOnJS(onPanUpdate)(screenDx);
    })
    .onEnd((event) => {
      const absDx = event.absoluteX - startAbsX.value;
      const screenDx = Math.min(event.translationX, absDx);
      runOnJS(onPanEnd)(screenDx);
      dragX.value = withTiming(0);
    })
    .onFinalize((_event, success) => {
      if (!success) {
        runOnJS(onPanCancel)();
      }
      dragX.value = withTiming(0);
    });

  const tap = Gesture.Tap()
    .maxDuration(LONG_PRESS_MS)
    .enabled(!disabled)
    .onEnd(() => {
      runOnJS(onShortTap)();
    });

  const gesture = Gesture.Exclusive(pan, tap);
  const elapsedMs = Math.min(clampMaxDuration(recState.durationMillis), limitMs);

  return {
    gesture,
    uiRecording,
    cancelArmed,
    toastMessage,
    elapsedMs,
    level: meteringToLevel(recState.metering),
    dragX,
    pulse,
    chevronX,
  };
}

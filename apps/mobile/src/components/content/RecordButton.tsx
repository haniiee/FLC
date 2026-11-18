import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Mic, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { enableRecordingAudioMode, restorePlaybackAudioMode } from "../../lib/playback-audio-mode";
import {
  CANCEL_SLIDE_PX,
  MAX_RECORD_MS,
  clampMaxDuration,
  decideRecordingStart,
  formatRecTimer,
  isCancelGesture,
  meteringToLevel,
  resolveStartOutcome,
  shouldDiscard,
} from "../../lib/record-logic";
import type { VoiceCapture } from "../../lib/upload-voice";
import { deleteLocalCapture } from "../../lib/upload-voice";
import { usePlayerOptional } from "../../player/context";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";

const LONG_PRESS_MS = 180;
const RECORD_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

type RecordButtonProps = {
  onCaptured: (capture: VoiceCapture) => void;
  disabled?: boolean;
};

export function RecordButton({ onCaptured, disabled }: RecordButtonProps) {
  const { colors, spacing, isDark, cardShadow } = useTheme();
  const insets = useSafeAreaInsets();
  const player = usePlayerOptional();

  const [uiRecording, setUiRecording] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeRef = useRef(false);
  const finishingRef = useRef(false);
  /** True while beginRecording is still inside its startup awaits. */
  const startingRef = useRef(false);
  /** True until the in-flight stop/abort has released the recorder. */
  const stoppingRef = useRef(false);
  /** Ignore isFinished emitted by our own stop(), so it cannot finish the next take. */
  const suppressFinishedRef = useRef(false);
  /** Serializes recorder and audio-mode operations so they never overlap. */
  const opChainRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Monotonic id of the latest pan that was allowed to start. */
  const gestureIdRef = useRef(0);
  /** Highest gesture id whose finger has lifted or been cancelled. */
  const releasedIdRef = useRef(0);
  /** Gesture that owns the live recorder, once record() has been called. */
  const activeGestureIdRef = useRef<number | null>(null);
  /** Gesture whose recording overlay is actually on screen. */
  const uiGestureIdRef = useRef<number | null>(null);
  const uiRecordingRef = useRef(false);
  const micGrantedRef = useRef<boolean | null>(null);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;
  const finishRef = useRef<(cancel: boolean) => Promise<void>>(async () => undefined);

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

  // Keep MiniPlayer out of the way for the whole overlay lifetime.
  useEffect(() => {
    player?.setRecordingOverlay(uiRecording);
    return () => {
      player?.setRecordingOverlay(false);
    };
  }, [player, uiRecording]);

  // Warm permission status so a typical hold skips the request dialog await.
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

  const enqueue = useCallback(<T,>(operation: () => Promise<T> | T): Promise<T> => {
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

  const stoppingDepthRef = useRef(0);
  const markStopping = useCallback(() => {
    stoppingDepthRef.current += 1;
    stoppingRef.current = true;
  }, []);
  const unmarkStopping = useCallback(() => {
    stoppingDepthRef.current = Math.max(0, stoppingDepthRef.current - 1);
    stoppingRef.current = stoppingDepthRef.current > 0;
  }, []);

  /** expo-audio 58 has no reset(); stop() releases a prepared MediaRecorder. */
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
      // Upload only when the overlay and the recorder belong to this same gesture.
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
            durationMs = clampMaxDuration(recorder.getStatus().durationMillis);
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

        if (cancel) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (uri) await deleteLocalCapture(uri);
          return;
        }

        if (!uri || shouldDiscard(durationMs)) {
          showHoldToast();
          if (uri) await deleteLocalCapture(uri);
          return;
        }

        onCapturedRef.current({
          uri,
          durationMs,
          mimeType: "audio/mp4",
          fileName: "recording.m4a",
        });
      } finally {
        unmarkStopping();
        finishingRef.current = false;
      }
    },
    [clearRecordingState, enqueue, markStopping, recorder, showHoldToast, unmarkStopping],
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
        await enqueue(() => enableRecordingAudioMode());
        audioMode = true;
        if (await abortIfStale(false)) return;

        await enqueue(() => recorder.prepareToRecordAsync());
        prepared = true;
        if (await abortIfStale(false)) return;

        await enqueue(async () => {
          recorder.record({ forDuration: MAX_RECORD_MS / 1000 });
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
      player,
      recorder,
      releaseRecorder,
      restoreAudioMode,
      showToast,
    ],
  );

  // Backup auto-send at the 10-minute ceiling.
  useEffect(() => {
    if (!uiRecording || !activeRef.current) return;
    if (recState.durationMillis >= MAX_RECORD_MS) {
      void finishRecording(false);
    }
  }, [finishRecording, recState.durationMillis, uiRecording]);

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
    // screenDx: absoluteX - startAbsoluteX (negative = screen-left), RTL-safe.
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
    .onStart((e) => {
      startAbsX.value = e.absoluteX;
      dragX.value = 0;
      runOnJS(onPanStart)();
    })
    .onUpdate((e) => {
      // Prefer the more leftward signal — absoluteX is RTL-safe; translationX
      // still helps when absolute deltas are sparse (e.g. some emulator swipes).
      const absDx = e.absoluteX - startAbsX.value;
      const screenDx = Math.min(e.translationX, absDx);
      dragX.value = screenDx;
      runOnJS(onPanUpdate)(screenDx);
    })
    .onEnd((e) => {
      const absDx = e.absoluteX - startAbsX.value;
      const screenDx = Math.min(e.translationX, absDx);
      runOnJS(onPanEnd)(screenDx);
      dragX.value = withTiming(0);
    })
    .onFinalize((_e, success) => {
      // Interrupted by scroll/RefreshControl/etc — cancel any in-flight recording.
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

  const composed = Gesture.Exclusive(pan, tap);

  // Only the hint row slides with the finger; card stays fixed.
  const hintShift = useAnimatedStyle(() => {
    const dx = Math.min(0, Math.max(-CANCEL_SLIDE_PX, dragX.value));
    return {
      transform: [{ translateX: dx }],
      opacity: interpolate(dx, [-CANCEL_SLIDE_PX, 0], [0.7, 1], "clamp"),
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.35], [1, 0.35]),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: chevronX.value }],
  }));

  const level = meteringToLevel(recState.metering);
  const timerLabel = formatRecTimer(uiRecording ? clampMaxDuration(recState.durationMillis) : 0);
  const hintColor = cancelArmed ? ("danger" as const) : ("textMuted" as const);
  const hintText = cancelArmed ? copy.content.releaseToCancel : copy.content.slideToCancel;
  const meterDim = cancelArmed ? 0.5 : 1;
  // spacing[4] = 16 ≈ design "md"
  const marginMd = spacing[4];

  return (
    <>
      <GestureDetector gesture={composed}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={copy.a11y.recordVoice}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Mic size={22} color={cancelArmed ? colors.danger : colors.primary} />
        </Animated.View>
      </GestureDetector>

      <Modal visible={uiRecording} transparent animationType="fade" statusBarTranslucent>
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}
        >
          {/* Fixed opaque card — never translateX / never fade with drag. */}
          <View
            style={{
              position: "absolute",
              left: marginMd,
              right: marginMd,
              bottom: insets.bottom + marginMd,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3] + 2,
              borderRadius: 16,
              backgroundColor: colors.surface,
              borderWidth: isDark ? 1 : 0,
              borderColor: colors.border,
              gap: spacing[2],
              opacity: 1,
              zIndex: 200,
              elevation: 24,
              overflow: "hidden",
              ...(cardShadow ?? {}),
            }}
          >
            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={{ gap: spacing[2] }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  opacity: meterDim,
                }}
              >
                <View
                  style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}
                >
                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: colors.danger,
                      },
                      pulseStyle,
                    ]}
                  />
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.danger,
                    }}
                  />
                </View>
                <AppText variant="h3" style={{ minWidth: 48 }}>
                  {timerLabel}
                </AppText>
                <View
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: isDark ? colors.surfaceMuted : colors.border,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(level * 100)}%`,
                      height: "100%",
                      borderRadius: 4,
                      backgroundColor: cancelArmed ? colors.danger : colors.primary,
                    }}
                  />
                </View>
              </View>
              <Animated.View
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing[1],
                  },
                  hintShift,
                ]}
              >
                {cancelArmed ? (
                  <Trash2 size={16} color={colors.danger} />
                ) : (
                  <Animated.View style={chevronStyle}>
                    <ChevronLeft size={16} color={colors.textMuted} />
                  </Animated.View>
                )}
                <AppText variant="caption" color={hintColor} style={{ textAlign: "center" }}>
                  {hintText}
                </AppText>
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      </Modal>

      {toastMessage ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(120)}
              style={{
                position: "absolute",
                alignSelf: "center",
                left: spacing[8],
                right: spacing[8],
                bottom: insets.bottom + spacing[6],
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2] + 2,
                borderRadius: 999,
                backgroundColor: colors.surface,
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.border,
                alignItems: "center",
                ...(cardShadow ?? {}),
              }}
            >
              <AppText variant="caption">{toastMessage}</AppText>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

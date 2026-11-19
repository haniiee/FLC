import { ChevronLeft, Mic, Trash2 } from "lucide-react-native";
import { Modal, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHoldToRecord } from "../../hooks/useHoldToRecord";
import { copy } from "../../lib/copy";
import { CANCEL_SLIDE_PX, formatRecTimer } from "../../lib/record-logic";
import type { VoiceCapture } from "../../lib/upload-voice";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";

type RecordButtonProps = {
  onCaptured: (capture: VoiceCapture) => void;
  disabled?: boolean;
};

export function RecordButton({ onCaptured, disabled }: RecordButtonProps) {
  const { colors, spacing, isDark, cardShadow } = useTheme();
  const insets = useSafeAreaInsets();
  const hold = useHoldToRecord({ onCaptured, disabled });
  const { dragX, pulse, chevronX } = hold;

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

  const timerLabel = formatRecTimer(hold.uiRecording ? hold.elapsedMs : 0);
  const hintColor = hold.cancelArmed ? ("danger" as const) : ("textMuted" as const);
  const hintText = hold.cancelArmed ? copy.content.releaseToCancel : copy.content.slideToCancel;
  const meterDim = hold.cancelArmed ? 0.5 : 1;
  const marginMd = spacing[4];

  return (
    <>
      <GestureDetector gesture={hold.gesture}>
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
          <Mic size={22} color={hold.cancelArmed ? colors.danger : colors.primary} />
        </Animated.View>
      </GestureDetector>

      <Modal visible={hold.uiRecording} transparent animationType="fade" statusBarTranslucent>
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
                      width: `${Math.round(hold.level * 100)}%`,
                      height: "100%",
                      borderRadius: 4,
                      backgroundColor: hold.cancelArmed ? colors.danger : colors.primary,
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
                {hold.cancelArmed ? (
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

      {hold.toastMessage ? (
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
              <AppText variant="caption">{hold.toastMessage}</AppText>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

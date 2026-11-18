import { Mic, Send } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useHoldToRecord } from "../../hooks/useHoldToRecord";
import { CHAT_TEXT_MAX } from "../../lib/chat-logic";
import { CHAT_VOICE_MAX_MS } from "../../lib/chat-voice";
import { copy } from "../../lib/copy";
import { formatRecTimer } from "../../lib/record-logic";
import type { VoiceCapture } from "../../lib/upload-voice";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { useChatVoiceOptional } from "./ChatVoiceProvider";

type ChatComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onVoice: (capture: VoiceCapture) => void;
  bottomInset: number;
};

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onVoice,
  bottomInset,
}: ChatComposerProps) {
  const { colors } = useTheme();
  const chatVoice = useChatVoiceOptional();
  const voiceRef = useRef(chatVoice);
  voiceRef.current = chatVoice;
  const hasText = value.trim().length > 0;
  const hold = useHoldToRecord({
    disabled: hasText,
    maxDurationMs: CHAT_VOICE_MAX_MS,
    onCaptured: onVoice,
    onBeforeRecord: () => voiceRef.current?.pause(),
  });
  const showMic = !hasText || hold.uiRecording;
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hold.pulse.value }],
    opacity: hold.uiRecording ? 1 : 0,
  }));

  return (
    <View style={{ position: "relative" }}>
      {hold.toastMessage ? (
        <View pointerEvents="none" style={{ alignItems: "center", paddingBottom: 6 }}>
          <View
            accessibilityLiveRegion="polite"
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <AppText variant="caption">{hold.toastMessage}</AppText>
          </View>
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: bottomInset,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        {hold.uiRecording ? (
          <View
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 22,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
              <Animated.View
                style={[
                  {
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.danger,
                  },
                  dotStyle,
                ]}
              />
            </View>
            <AppText variant="body" style={{ minWidth: 40 }}>
              {formatRecTimer(hold.elapsedMs)}
            </AppText>
            <AppText
              variant="caption"
              color={hold.cancelArmed ? "danger" : "textMuted"}
              style={{ flex: 1, textAlign: "right" }}
            >
              {hold.cancelArmed ? copy.content.releaseToCancel : copy.chats.slideToCancel}
            </AppText>
          </View>
        ) : (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={CHAT_TEXT_MAX}
            placeholder={copy.chats.messagePlaceholder}
            placeholderTextColor={colors.placeholder}
            textAlignVertical="top"
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
              backgroundColor: colors.surfaceMuted,
              color: colors.text,
              fontFamily: "PlusJakartaSans_400Regular",
              fontSize: 16,
            }}
          />
        )}
        {showMic ? (
          <GestureDetector gesture={hold.gesture}>
            <View
              accessibilityRole="button"
              accessibilityLabel={copy.a11y.recordVoice}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: hold.uiRecording ? colors.danger : colors.primary,
              }}
            >
              <Mic size={18} color={colors.onPrimary} />
            </View>
          </GestureDetector>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.chats.send}
            accessibilityState={{ disabled: !hasText }}
            disabled={!hasText}
            onPress={onSend}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: hasText ? colors.primary : colors.surfaceMuted,
            }}
          >
            <Send size={18} color={hasText ? colors.onPrimary : colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

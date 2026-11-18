import { Pause, Play } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { ClientChatMessage } from "../../lib/chat-logic";
import { voiceBubblePhase, voicePlaybackClock } from "../../lib/chat-voice";
import { copy } from "../../lib/copy";
import { formatRecTimer } from "../../lib/record-logic";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { useChatVoice } from "./ChatVoiceProvider";

type VoiceMessageBubbleProps = {
  message: ClientChatMessage;
  mine: boolean;
};

export function VoiceMessageBubble({ message, mine }: VoiceMessageBubbleProps) {
  const { colors } = useTheme();
  const voice = useChatVoice();
  const [barWidth, setBarWidth] = useState(0);
  const phase = voiceBubblePhase(message);
  const active = voice.activeId === message.id;
  const playing = active && voice.playing;
  const clock = voicePlaybackClock({
    active,
    currentTimeSec: voice.currentTime,
    durationSec: voice.duration,
    durationMs: message.durationMs,
  });
  const ink = mine ? colors.onPrimary : colors.text;
  const muted = mine ? colors.onPrimary : colors.textMuted;
  const track = mine ? "rgba(255,255,255,0.35)" : colors.border;
  const fill = mine ? colors.onPrimary : colors.primary;

  if (phase === "sending" || phase === "upload-failed") {
    return (
      <View style={{ minWidth: 160, gap: 4 }}>
        <AppText variant="body" color={mine ? "onPrimary" : "text"}>
          {phase === "sending" ? copy.chats.sending : formatRecTimer(message.durationMs ?? 0)}
        </AppText>
        {phase === "sending" ? (
          <AppText variant="caption" style={{ color: muted }}>
            {formatRecTimer(message.durationMs ?? 0)}
          </AppText>
        ) : null}
      </View>
    );
  }

  if (phase === "processing") {
    return (
      <View style={{ minWidth: 160, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator size="small" color={ink} />
        <AppText variant="body" color={mine ? "onPrimary" : "text"}>
          {copy.chats.processing}
        </AppText>
      </View>
    );
  }

  if (phase === "process-failed") {
    return (
      <AppText variant="body" color={mine ? "onPrimary" : "text"} style={{ minWidth: 160 }}>
        {copy.chats.voiceProcessFailed}
      </AppText>
    );
  }

  return (
    <View style={{ minWidth: 200, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? copy.chats.pauseVoice : copy.chats.playVoice}
          onPress={() => voice.toggle(message.id)}
          hitSlop={6}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mine ? colors.onPrimary : colors.primary,
          }}
        >
          {playing ? (
            <Pause size={16} color={mine ? colors.primary : colors.onPrimary} />
          ) : (
            <Play size={16} color={mine ? colors.primary : colors.onPrimary} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={clock.label}
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
          onPress={(event) => {
            if (!active || barWidth <= 0) {
              voice.toggle(message.id);
              return;
            }
            voice.seek(message.id, event.nativeEvent.locationX / barWidth);
          }}
          style={{ flex: 1, height: 28, justifyContent: "center" }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: track,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.round(clock.ratio * 100)}%`,
                height: "100%",
                borderRadius: 2,
                backgroundColor: fill,
              }}
            />
          </View>
        </Pressable>
      </View>
      <AppText key={clock.label} variant="caption" style={{ color: muted }}>
        {clock.label}
      </AppText>
    </View>
  );
}

import { Pause, Play } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { ClientChatMessage } from "../../lib/chat-logic";
import { voiceBubblePhase, voicePlaybackClock } from "../../lib/chat-voice";
import { copy } from "../../lib/copy";
import { formatRecTimer } from "../../lib/record-logic";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { useChatVoice, useChatVoiceProgress } from "./ChatVoiceProvider";

type VoiceMessageBubbleProps = {
  message: ClientChatMessage;
  mine: boolean;
};

export function VoiceMessageBubble({ message, mine }: VoiceMessageBubbleProps) {
  const { colors } = useTheme();
  const voice = useChatVoice();
  const phase = voiceBubblePhase(message);
  const active = voice.activeId === message.id;
  const playing = active && voice.playing;
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

  return active ? (
    <ActiveVoiceBody
      message={message}
      playing={playing}
      buttonColor={mine ? colors.onPrimary : colors.primary}
      iconColor={mine ? colors.primary : colors.onPrimary}
      track={track}
      fill={fill}
      muted={muted}
      onToggle={() => voice.toggle(message.id)}
      onSeek={(ratio) => voice.seek(message.id, ratio)}
    />
  ) : (
    <VoiceBody
      playing={false}
      clock={voicePlaybackClock({
        active: false,
        currentTimeSec: 0,
        durationSec: 0,
        durationMs: message.durationMs,
      })}
      buttonColor={mine ? colors.onPrimary : colors.primary}
      iconColor={mine ? colors.primary : colors.onPrimary}
      track={track}
      fill={fill}
      muted={muted}
      onToggle={() => voice.toggle(message.id)}
    />
  );
}

function ActiveVoiceBody({
  message,
  playing,
  buttonColor,
  iconColor,
  track,
  fill,
  muted,
  onToggle,
  onSeek,
}: {
  message: ClientChatMessage;
  playing: boolean;
  buttonColor: string;
  iconColor: string;
  track: string;
  fill: string;
  muted: string;
  onToggle: () => void;
  onSeek: (ratio: number) => void;
}) {
  const progress = useChatVoiceProgress();
  const clock = voicePlaybackClock({
    active: true,
    currentTimeSec: progress.currentTime,
    durationSec: progress.duration,
    durationMs: message.durationMs,
  });
  return (
    <VoiceBody
      playing={playing}
      clock={clock}
      buttonColor={buttonColor}
      iconColor={iconColor}
      track={track}
      fill={fill}
      muted={muted}
      onToggle={onToggle}
      onSeek={onSeek}
    />
  );
}

function VoiceBody({
  playing,
  clock,
  buttonColor,
  iconColor,
  track,
  fill,
  muted,
  onToggle,
  onSeek,
}: {
  playing: boolean;
  clock: ReturnType<typeof voicePlaybackClock>;
  buttonColor: string;
  iconColor: string;
  track: string;
  fill: string;
  muted: string;
  onToggle: () => void;
  onSeek?: (ratio: number) => void;
}) {
  return (
    <View style={{ minWidth: 200, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? copy.chats.pauseVoice : copy.chats.playVoice}
          onPress={onToggle}
          hitSlop={6}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: buttonColor,
          }}
        >
          {playing ? <Pause size={16} color={iconColor} /> : <Play size={16} color={iconColor} />}
        </Pressable>
        <VoiceMeterBar
          label={clock.label}
          ratio={clock.ratio}
          track={track}
          fill={fill}
          onToggle={onToggle}
          onSeek={onSeek}
        />
      </View>
      <AppText key={clock.label} variant="caption" style={{ color: muted }}>
        {clock.label}
      </AppText>
    </View>
  );
}

function VoiceMeterBar({
  label,
  ratio,
  track,
  fill,
  onToggle,
  onSeek,
}: {
  label: string;
  ratio: number;
  track: string;
  fill: string;
  onToggle: () => void;
  onSeek?: (ratio: number) => void;
}) {
  const [barWidth, setBarWidth] = useState(0);
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setBarWidth((prev) => (prev === width ? prev : width));
      }}
      onPress={(event) => {
        if (!onSeek || barWidth <= 0) {
          onToggle();
          return;
        }
        onSeek(event.nativeEvent.locationX / barWidth);
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
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            borderRadius: 2,
            backgroundColor: fill,
          }}
        />
      </View>
    </Pressable>
  );
}

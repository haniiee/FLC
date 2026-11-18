import { Ban } from "lucide-react-native";
import { Pressable, View } from "react-native";
import type { ClientChatMessage } from "../../lib/chat-logic";
import { formatMessageTime, senderBadge } from "../../lib/chat-logic";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { VoiceMessageBubble } from "./VoiceMessageBubble";

type MessageBubbleProps = {
  message: ClientChatMessage;
  mine: boolean;
  showSender: boolean;
  showTime: boolean;
  grouped: boolean;
  onLongPress: () => void;
  onRetry: () => void;
};

export function MessageBubble({
  message,
  mine,
  showSender,
  showTime,
  grouped,
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const { colors, isDark } = useTheme();
  const deleted = message.deleted;
  const badge = showSender ? senderBadge(message.sender.role) : null;
  const isVoice = !deleted && message.type === "voice";
  const body = deleted
    ? copy.chats.messageDeleted
    : isVoice
      ? copy.chats.playVoice
      : (message.text ?? "");
  const bubbleColor = deleted
    ? colors.surfaceMuted
    : mine
      ? colors.primary
      : isDark
        ? colors.surfaceElevated
        : colors.surface;
  const textColor = deleted ? "textMuted" : mine ? "onPrimary" : "text";

  return (
    <View
      style={{
        alignItems: mine ? "flex-end" : "flex-start",
        marginTop: grouped ? 2 : 10,
        paddingHorizontal: 12,
      }}
    >
      {showSender ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
            paddingHorizontal: 4,
          }}
        >
          <AppText variant="caption" color="textMuted">
            {message.sender.displayName}
          </AppText>
          {badge ? (
            <View
              style={{
                backgroundColor: colors.primarySoft,
                borderRadius: 999,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <AppText variant="caption" color="primary">
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="text"
        accessibilityLabel={body}
        delayLongPress={350}
        onLongPress={deleted ? undefined : onLongPress}
        onPress={message.sendFailed ? onRetry : undefined}
        style={{
          maxWidth: "82%",
          backgroundColor: bubbleColor,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: deleted || !mine ? 1 : 0,
          borderColor: message.sendFailed ? colors.danger : colors.border,
        }}
      >
        {deleted ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ban size={14} color={colors.textMuted} />
            <AppText variant="body" color="textMuted">
              {copy.chats.messageDeleted}
            </AppText>
          </View>
        ) : isVoice ? (
          <VoiceMessageBubble message={message} mine={mine} />
        ) : (
          <AppText variant="body" color={textColor}>
            {body}
          </AppText>
        )}
      </Pressable>
      {showTime ? (
        <AppText variant="caption" color="textMuted" style={{ marginTop: 2, paddingHorizontal: 4 }}>
          {formatMessageTime(message.createdAt)}
        </AppText>
      ) : null}
      {message.sendFailed ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={6}>
          <AppText variant="caption" color="danger">
            {copy.content.failedRetry}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

import type { ChatMessage, GroupRole } from "@app/shared-types";
import type { ChatMessageRow, User } from "../db/schema";

export function toChatMessageDto(
  message: ChatMessageRow,
  sender: { id: string; displayName: string; role: GroupRole },
): ChatMessage {
  const deleted = message.deletedAt !== null;
  return {
    id: message.id,
    channelId: message.channelId,
    type: message.type,
    text: deleted ? null : message.text,
    mimeType: message.mimeType,
    sizeBytes: message.sizeBytes,
    durationMs: message.durationMs,
    status: message.status,
    processingError: message.processingError,
    replyToId: message.replyToId,
    createdAt: message.createdAt.toISOString(),
    deleted,
    sender: {
      id: sender.id,
      displayName: sender.displayName,
      role: sender.role,
    },
  };
}

export function senderFromUser(user: User, role: GroupRole) {
  return {
    id: user.id,
    displayName: user.displayName,
    role,
  };
}

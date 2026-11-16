import { z } from "zod";
import { GroupRoleSchema } from "./auth";
import { FileStatusSchema } from "./content";

export const ChatChannelKindSchema = z.enum(["all", "students"]);
export type ChatChannelKind = z.infer<typeof ChatChannelKindSchema>;

export const ChatMessageTypeSchema = z.enum(["text", "voice"]);
export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>;

export const ChatMessageStatusSchema = FileStatusSchema;
export type ChatMessageStatus = z.infer<typeof ChatMessageStatusSchema>;

export const ChatSenderSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  role: GroupRoleSchema,
});
export type ChatSender = z.infer<typeof ChatSenderSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  type: ChatMessageTypeSchema,
  text: z.string().nullable(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable(),
  status: ChatMessageStatusSchema,
  processingError: z.string().nullable().optional(),
  replyToId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  deleted: z.boolean(),
  sender: ChatSenderSchema,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatChannelSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  kind: ChatChannelKindSchema,
  createdAt: z.string().datetime(),
  lastMessage: ChatMessageSchema.nullable(),
});
export type ChatChannel = z.infer<typeof ChatChannelSchema>;

export const ChatChannelsResponseSchema = z.object({
  channels: z.array(ChatChannelSchema),
});
export type ChatChannelsResponse = z.infer<typeof ChatChannelsResponseSchema>;

export const ChatMessagesResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
});
export type ChatMessagesResponse = z.infer<typeof ChatMessagesResponseSchema>;

export const CreateChatTextBodySchema = z.object({
  text: z.string().min(1).max(4000),
  replyToId: z.string().uuid().optional(),
});
export type CreateChatTextBody = z.infer<typeof CreateChatTextBodySchema>;

export const ChatVoiceUploadBodySchema = z.object({
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});
export type ChatVoiceUploadBody = z.infer<typeof ChatVoiceUploadBodySchema>;

export const ChatVoiceUploadResponseSchema = z.object({
  message: ChatMessageSchema,
  uploadUrl: z.string().url(),
  expiresIn: z.literal(900),
});
export type ChatVoiceUploadResponse = z.infer<typeof ChatVoiceUploadResponseSchema>;

export const ChatMessageUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
});
export type ChatMessageUrlResponse = z.infer<typeof ChatMessageUrlResponseSchema>;

/** Client → server */
export const ChatJoinPayloadSchema = z.object({
  channelId: z.string().uuid(),
});
export type ChatJoinPayload = z.infer<typeof ChatJoinPayloadSchema>;

/** Server → client event payloads */
export const MessageDeletedEventSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
});
export type MessageDeletedEvent = z.infer<typeof MessageDeletedEventSchema>;

export type ChatClientToServerEvents = {
  "chat:join": (
    payload: ChatJoinPayload,
    ack?: (result: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "chat:leave": (payload?: { channelId?: string }) => void;
};

export type ChatServerToClientEvents = {
  "message:new": (message: ChatMessage) => void;
  "message:updated": (message: ChatMessage) => void;
  "message:deleted": (payload: MessageDeletedEvent) => void;
};

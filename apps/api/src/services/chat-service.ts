import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { ChatChannel, ChatMessage, GroupRole } from "@app/shared-types";
import { db } from "../db";
import { chatChannels, chatMessages, groupMembers, users } from "../db/schema";
import { canDeleteMessage, listAccessibleChannels, requireChannelAccess } from "../lib/chat-access";
import { toChatMessageDto } from "../lib/chat-mappers";
import { AppError, badRequest, forbidden, notFound } from "../lib/errors";
import { scheduleProcessAudio } from "../media/process-audio";
import { emitMessageDeleted, emitMessageNew } from "../realtime";
import {
  assertChatVoiceAllowed,
  baseMime,
  buildChatVoiceStorageKey,
  createDownloadUrl,
  createUploadUrl,
  deleteStorageKeys,
  extensionForMime,
  headObject,
} from "../storage";

async function resolveSenderRole(
  groupId: string,
  userId: string,
): Promise<{ displayName: string; role: GroupRole }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
  }
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });
  return {
    displayName: user.displayName,
    role: (membership?.role ?? "student") as GroupRole,
  };
}

async function toMessageDto(message: typeof chatMessages.$inferSelect): Promise<ChatMessage> {
  const channel = await db.query.chatChannels.findFirst({
    where: eq(chatChannels.id, message.channelId),
  });
  if (!channel) {
    throw notFound("CHANNEL_NOT_FOUND", "کانال پیدا نشد");
  }
  const sender = await resolveSenderRole(channel.groupId, message.senderId);
  return toChatMessageDto(message, {
    id: message.senderId,
    displayName: sender.displayName,
    role: sender.role,
  });
}

async function latestMessageForChannel(channelId: string): Promise<ChatMessage | null> {
  const row = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.channelId, channelId),
    orderBy: [desc(chatMessages.createdAt), desc(chatMessages.id)],
  });
  if (!row) return null;
  return toMessageDto(row);
}

export async function listGroupChats(userId: string, groupId: string): Promise<ChatChannel[]> {
  const { channels } = await listAccessibleChannels(userId, groupId);
  const result: ChatChannel[] = [];
  for (const channel of channels) {
    result.push({
      id: channel.id,
      groupId: channel.groupId,
      kind: channel.kind,
      createdAt: channel.createdAt.toISOString(),
      lastMessage: await latestMessageForChannel(channel.id),
    });
  }
  return result;
}

export async function listChannelMessages(input: {
  userId: string;
  channelId: string;
  before?: string;
  limit?: number;
}): Promise<ChatMessage[]> {
  await requireChannelAccess(input.userId, input.channelId);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);

  let cursor: { createdAt: Date; id: string } | null = null;
  if (input.before) {
    const beforeRow = await db.query.chatMessages.findFirst({
      where: and(eq(chatMessages.id, input.before), eq(chatMessages.channelId, input.channelId)),
    });
    if (!beforeRow) {
      throw badRequest("INVALID_CURSOR", "قبل از این پیام معتبر نیست");
    }
    cursor = { createdAt: beforeRow.createdAt, id: beforeRow.id };
  }

  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      cursor
        ? and(
            eq(chatMessages.channelId, input.channelId),
            or(
              lt(chatMessages.createdAt, cursor.createdAt),
              and(eq(chatMessages.createdAt, cursor.createdAt), lt(chatMessages.id, cursor.id)),
            ),
          )
        : eq(chatMessages.channelId, input.channelId),
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit);

  return Promise.all(rows.map((row) => toMessageDto(row)));
}

export async function createTextMessage(input: {
  userId: string;
  channelId: string;
  text: string;
  replyToId?: string;
}): Promise<ChatMessage> {
  const { channel } = await requireChannelAccess(input.userId, input.channelId);
  const text = input.text.trim();
  if (!text) {
    throw badRequest("EMPTY_TEXT", "متن پیام خالی است");
  }
  if (text.length > 4000) {
    throw badRequest("TEXT_TOO_LONG", "متن پیام بیش از حد مجاز است");
  }

  if (input.replyToId) {
    const reply = await db.query.chatMessages.findFirst({
      where: and(
        eq(chatMessages.id, input.replyToId),
        eq(chatMessages.channelId, input.channelId),
        isNull(chatMessages.deletedAt),
      ),
    });
    if (!reply) {
      throw badRequest("REPLY_NOT_FOUND", "پیام پاسخ‌شده پیدا نشد");
    }
  }

  const [created] = await db
    .insert(chatMessages)
    .values({
      channelId: channel.id,
      senderId: input.userId,
      type: "text",
      text,
      status: "ready",
      replyToId: input.replyToId ?? null,
    })
    .returning();

  if (!created) {
    throw badRequest("MESSAGE_CREATE_FAILED", "ساخت پیام ناموفق بود");
  }

  const dto = await toMessageDto(created);
  emitMessageNew(dto);
  return dto;
}

export async function createVoiceUploadUrl(input: {
  userId: string;
  channelId: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const { channel } = await requireChannelAccess(input.userId, input.channelId);
  assertChatVoiceAllowed(input.mimeType, input.sizeBytes);
  const storedMime = baseMime(input.mimeType);
  const ext = extensionForMime(storedMime, "audio");

  const message = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chatMessages)
      .values({
        channelId: channel.id,
        senderId: input.userId,
        type: "voice",
        text: null,
        mimeType: storedMime,
        sizeBytes: input.sizeBytes,
        status: "pending",
      })
      .returning();

    if (!created) {
      throw badRequest("MESSAGE_CREATE_FAILED", "ساخت پیام ناموفق بود");
    }

    const storageKey = buildChatVoiceStorageKey(channel.groupId, channel.id, created.id, ext);
    const [updated] = await tx
      .update(chatMessages)
      .set({ storageKey })
      .where(eq(chatMessages.id, created.id))
      .returning();

    return updated ?? created;
  });

  const uploadUrl = await createUploadUrl(message.storageKey!, storedMime, 900);
  const dto = await toMessageDto(message);
  return {
    message: dto,
    uploadUrl,
    expiresIn: 900 as const,
  };
}

export async function completeChatVoice(messageId: string, userId: string) {
  const message = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, messageId),
  });
  if (!message || message.type !== "voice") {
    throw notFound("MESSAGE_NOT_FOUND", "پیام پیدا نشد");
  }
  if (message.senderId !== userId) {
    throw forbidden("NOT_SENDER", "فقط فرستنده می‌تواند آپلود را تکمیل کند");
  }
  if (!message.storageKey) {
    throw badRequest("MESSAGE_NO_STORAGE", "پیام ذخیره‌سازی ندارد");
  }

  await requireChannelAccess(userId, message.channelId);

  try {
    const head = await headObject(message.storageKey);
    const remoteSize = head.ContentLength ?? 0;
    const expected = message.sizeBytes ?? 0;
    const tolerance = Math.max(32, Math.floor(expected * 0.01));
    if (Math.abs(remoteSize - expected) > tolerance) {
      await db
        .update(chatMessages)
        .set({ status: "failed", processingError: "FILE_SIZE_MISMATCH" })
        .where(eq(chatMessages.id, messageId));
      throw badRequest("FILE_SIZE_MISMATCH", "حجم فایل آپلودشده با مقدار اعلامی مطابقت ندارد");
    }

    const [processing] = await db
      .update(chatMessages)
      .set({
        status: "processing",
        processingError: null,
      })
      .where(eq(chatMessages.id, messageId))
      .returning();

    if (!processing) {
      throw notFound("MESSAGE_NOT_FOUND", "پیام پیدا نشد");
    }

    scheduleProcessAudio({ table: "chat_messages", id: messageId });
    const dto = await toMessageDto(processing);
    return { message: dto, httpStatus: 202 as const };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    await db
      .update(chatMessages)
      .set({ status: "failed", processingError: "FILE_NOT_UPLOADED" })
      .where(eq(chatMessages.id, messageId));
    throw badRequest("FILE_NOT_UPLOADED", "فایل در ذخیره‌سازی پیدا نشد");
  }
}

export async function getChatMessageUrl(messageId: string, userId: string) {
  const message = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, messageId),
  });
  if (!message || message.type !== "voice") {
    throw notFound("MESSAGE_NOT_FOUND", "پیام پیدا نشد");
  }
  if (message.deletedAt) {
    throw notFound("MESSAGE_DELETED", "پیام حذف شده است");
  }
  if (message.status !== "ready" || !message.storageKey) {
    throw badRequest("MESSAGE_NOT_READY", "پیام صوتی هنوز آماده نیست");
  }

  await requireChannelAccess(userId, message.channelId);

  const expiresIn = 3600;
  const url = await createDownloadUrl(message.storageKey, { expiresIn });
  return { url, expiresIn };
}

export async function deleteChatMessage(messageId: string, userId: string) {
  const message = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, messageId),
  });
  if (!message) {
    throw notFound("MESSAGE_NOT_FOUND", "پیام پیدا نشد");
  }
  if (message.deletedAt) {
    return { ok: true as const };
  }

  const { channel, role } = await requireChannelAccess(userId, message.channelId);
  if (
    !canDeleteMessage({
      userId,
      role,
      channelKind: channel.kind,
      senderId: message.senderId,
    })
  ) {
    throw forbidden("DELETE_FORBIDDEN", "حذف این پیام مجاز نیست");
  }

  const [updated] = await db
    .update(chatMessages)
    .set({
      deletedAt: new Date(),
      text: null,
    })
    .where(eq(chatMessages.id, messageId))
    .returning();

  if (!updated) {
    throw notFound("MESSAGE_NOT_FOUND", "پیام پیدا نشد");
  }

  if (message.type === "voice" && message.storageKey) {
    await deleteStorageKeys([message.storageKey]);
    await db.update(chatMessages).set({ storageKey: null }).where(eq(chatMessages.id, messageId));
  }

  emitMessageDeleted({ id: message.id, channelId: message.channelId });
  return { ok: true as const };
}

/** Ensure channels exist for every group (idempotent). */
export async function backfillMissingChatChannels(): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO chat_channels (id, group_id, kind, created_at)
    SELECT gen_random_uuid(), g.id, k.kind, now()
    FROM groups g
    CROSS JOIN (VALUES ('all'::chat_channel_kind), ('students'::chat_channel_kind)) AS k(kind)
    WHERE NOT EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.group_id = g.id AND c.kind = k.kind
    )
  `);
  return Number(result.count ?? 0);
}

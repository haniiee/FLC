import { and, eq } from "drizzle-orm";
import type { GroupRole } from "@app/shared-types";
import { db } from "../db";
import { chatChannels, groupMembers, type ChatChannelRow } from "../db/schema";
import { forbidden, notFound } from "./errors";
import { getMembership } from "./group-access";

export type ChannelAccess = {
  channel: ChatChannelRow;
  role: GroupRole;
};

type DbExecutor = {
  query: typeof db.query;
  insert: typeof db.insert;
};

export async function canAccessChannel(userId: string, channelId: string): Promise<boolean> {
  const channel = await db.query.chatChannels.findFirst({
    where: eq(chatChannels.id, channelId),
  });
  if (!channel) {
    return false;
  }

  const membership = await getMembership(channel.groupId, userId);
  if (!membership) {
    return false;
  }

  if (channel.kind === "all") {
    return true;
  }

  return membership.role === "student";
}

export async function requireChannelAccess(
  userId: string,
  channelId: string,
): Promise<ChannelAccess> {
  const channel = await db.query.chatChannels.findFirst({
    where: eq(chatChannels.id, channelId),
  });
  if (!channel) {
    throw notFound("CHANNEL_NOT_FOUND", "کانال پیدا نشد");
  }

  const membership = await getMembership(channel.groupId, userId);
  if (!membership) {
    throw forbidden("GROUP_FORBIDDEN", "دسترسی به این گروه مجاز نیست");
  }

  if (channel.kind === "students" && membership.role !== "student") {
    throw forbidden("CHANNEL_FORBIDDEN", "دسترسی به این کانال مجاز نیست");
  }

  return { channel, role: membership.role };
}

export function canDeleteMessage(input: {
  userId: string;
  role: GroupRole;
  channelKind: ChatChannelRow["kind"];
  senderId: string;
}): boolean {
  if (input.senderId === input.userId) {
    return true;
  }
  if (input.channelKind === "all" && (input.role === "teacher" || input.role === "assistant")) {
    return true;
  }
  return false;
}

export async function ensureGroupChatChannels(
  groupId: string,
  executor: DbExecutor = db,
): Promise<void> {
  const existing = await executor.query.chatChannels.findMany({
    where: eq(chatChannels.groupId, groupId),
  });
  const kinds = new Set(existing.map((row) => row.kind));
  const toInsert: Array<{ groupId: string; kind: "all" | "students" }> = [];
  if (!kinds.has("all")) {
    toInsert.push({ groupId, kind: "all" });
  }
  if (!kinds.has("students")) {
    toInsert.push({ groupId, kind: "students" });
  }
  if (toInsert.length > 0) {
    await executor.insert(chatChannels).values(toInsert);
  }
}

export async function listAccessibleChannels(userId: string, groupId: string) {
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });
  if (!membership) {
    throw forbidden("GROUP_FORBIDDEN", "دسترسی به این گروه مجاز نیست");
  }

  const channels = await db.query.chatChannels.findMany({
    where: eq(chatChannels.groupId, groupId),
  });

  return {
    membership,
    channels: channels.filter((channel) => {
      if (channel.kind === "all") return true;
      return membership.role === "student";
    }),
  };
}

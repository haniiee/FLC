import type { ChatChannelKind, ChatMessage, ChatMessageType, GroupRole } from "@app/shared-types";

export const CHAT_PAGE_SIZE = 30;
export const CHAT_TEXT_MAX = 4000;

export type ClientChatMessage = ChatMessage & {
  /** Set on an optimistic row until the server id replaces it. */
  tempId?: string;
  sendFailed?: boolean;
  /** Local recording kept so a failed voice upload can retry without re-recording. */
  localUri?: string;
  localMimeType?: string;
  /** True while upload-url, PUT, and complete are in flight. */
  sending?: boolean;
};

export type ChatMessagesPage = {
  messages: ClientChatMessage[];
  /** True when the server page was full, so older messages may exist. */
  hasMore?: boolean;
};

export type ChatInfiniteData = {
  pages: ChatMessagesPage[];
  pageParams: Array<string | undefined>;
};

/** Consecutive messages from one sender closer together than this stay one group. */
export const CHAT_GROUP_GAP_MS = 5 * 60 * 1000;

export type ChatRow =
  | { type: "day"; key: string; label: string }
  | {
      type: "message";
      key: string;
      message: ClientChatMessage;
      showSender: boolean;
      /** True when this message continues the previous one in the same group. */
      grouped: boolean;
      /** True on the newest message of a group, and on every failed send. */
      showTime: boolean;
    };

export function chatMessagesQueryKey(channelId: string) {
  return ["chat-messages", channelId] as const;
}

export function channelLabel(kind: ChatChannelKind): string {
  return kind === "all" ? "Class chat" : "Students only";
}

export function parseChannelKind(value: string | undefined): ChatChannelKind | null {
  if (value === "all" || value === "students") return value;
  return null;
}

/** Order channels for display. Does not drop any channel the server returned. */
export function sortChannels<T extends { kind: ChatChannelKind }>(channels: T[]): T[] {
  return [...channels].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "all" ? -1 : 1;
  });
}

export function channelPath(input: {
  channelId: string;
  groupId: string;
  kind: ChatChannelKind;
  groupName: string;
}): string {
  const params = new URLSearchParams({
    groupId: input.groupId,
    kind: input.kind,
    groupName: input.groupName,
  });
  return `/chats/${input.channelId}?${params.toString()}`;
}

export function senderBadge(role: GroupRole): "Teacher" | "Assistant" | null {
  if (role === "teacher") return "Teacher";
  if (role === "assistant") return "Assistant";
  return null;
}

/**
 * Delete is offered on your own messages, and for a teacher or assistant on
 * every message. The server still enforces access and may answer 403.
 */
export function canDeleteMessage(input: {
  myUserId: string;
  myRole: GroupRole | null | undefined;
  senderId: string;
}): boolean {
  if (!input.myUserId) return false;
  if (input.senderId === input.myUserId) return true;
  return input.myRole === "teacher" || input.myRole === "assistant";
}

export function voicePlaceholder(durationMs: number | null | undefined): string {
  if (durationMs == null || durationMs < 0) return "Voice message";
  const total = Math.round(durationMs / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `Voice message · ${min}:${sec.toString().padStart(2, "0")}`;
}

export function lastMessagePreview(
  message: { type: ChatMessageType; text: string | null; deleted: boolean } | null,
): string {
  if (!message || (message.type === "text" && !message.deleted && !message.text?.trim())) {
    return "No messages yet";
  }
  if (message.deleted) return "Message deleted";
  if (message.type === "voice") return "🎤 Voice message";
  return message.text?.trim() || "No messages yet";
}

export function formatRelativeTime(iso: string, nowMs = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, nowMs - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date(nowMs).getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(date);
}

export function dayKey(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const start = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((start(now) - start(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(date);
}

export function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function createClientId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `temp-${cryptoObj.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createOptimisticText(input: {
  clientId: string;
  channelId: string;
  text: string;
  sender: ChatMessage["sender"];
  now?: Date;
}): ClientChatMessage {
  return {
    id: input.clientId,
    tempId: input.clientId,
    channelId: input.channelId,
    type: "text",
    text: input.text,
    durationMs: null,
    status: "ready",
    replyToId: null,
    createdAt: (input.now ?? new Date()).toISOString(),
    deleted: false,
    sender: input.sender,
    sendFailed: false,
  };
}

export function pageHasMore(fetchedCount: number, limit = CHAT_PAGE_SIZE): boolean {
  return fetchedCount >= limit;
}

/**
 * Cursor for the next page. The API accepts `before` as a message id (UUID),
 * not a timestamp — a createdAt value is rejected as INVALID_CURSOR.
 * `messages` is newest-first, so the oldest real id is the last one.
 */
export function nextMessageCursor(page: {
  messages: Array<{ id: string }>;
  hasMore?: boolean;
}): string | undefined {
  if (!page.hasMore) return undefined;
  for (let index = page.messages.length - 1; index >= 0; index -= 1) {
    const id = page.messages[index]?.id;
    if (id && !id.startsWith("temp-")) return id;
  }
  return undefined;
}

function cleanMessage(message: ClientChatMessage): ClientChatMessage {
  return {
    ...message,
    tempId: undefined,
    sendFailed: undefined,
    sending: undefined,
    localUri: undefined,
    localMimeType: undefined,
  };
}

function voiceStatusRank(status: ClientChatMessage["status"]): number {
  if (status === "ready" || status === "failed") return 2;
  if (status === "processing") return 1;
  return 0;
}

/** Keep a further-along voice status and a local duration the server has not filled in yet. */
function adoptServerMessage(
  existing: ClientChatMessage | undefined,
  incoming: ClientChatMessage,
): ClientChatMessage {
  return adoptServerMessageFrom(
    [existing].filter((row): row is ClientChatMessage => Boolean(row)),
    incoming,
  );
}

function adoptServerMessageFrom(
  existingRows: ClientChatMessage[],
  incoming: ClientChatMessage,
): ClientChatMessage {
  const next = cleanMessage(incoming);
  if (next.type !== "voice") return next;
  let merged = next;
  for (const existing of existingRows) {
    if (existing.type !== "voice") continue;
    if (
      (merged.durationMs == null || merged.durationMs <= 0) &&
      existing.durationMs != null &&
      existing.durationMs > 0
    ) {
      merged = { ...merged, durationMs: existing.durationMs };
    }
    if (
      existing.id === next.id &&
      !existing.tempId &&
      !existing.sending &&
      voiceStatusRank(existing.status) > voiceStatusRank(merged.status)
    ) {
      merged = {
        ...merged,
        status: existing.status,
        durationMs: existing.durationMs ?? merged.durationMs,
        mimeType: existing.mimeType ?? merged.mimeType,
      };
    }
  }
  return merged;
}

function isPendingOptimisticMatch(row: ClientChatMessage, incoming: ClientChatMessage): boolean {
  return Boolean(
    row.tempId &&
    !row.sendFailed &&
    row.type === "text" &&
    incoming.type === "text" &&
    row.sender.id === incoming.sender.id &&
    row.text === incoming.text,
  );
}

export function flattenMessages(
  data: { pages: Array<{ messages: ClientChatMessage[] }> } | undefined,
): ClientChatMessage[] {
  if (!data?.pages.length) return [];
  const seen = new Set<string>();
  const messages: ClientChatMessage[] = [];
  for (const page of data.pages) {
    for (const row of page.messages) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      messages.push(row);
    }
  }
  return messages;
}

function emptyData(): ChatInfiniteData {
  return { pages: [{ messages: [] }], pageParams: [undefined] };
}

export function applyNew(
  data: ChatInfiniteData | undefined,
  message: ClientChatMessage,
): ChatInfiniteData {
  const base = data ?? emptyData();
  const already = base.pages.some((page) =>
    page.messages.some((row) => row.id === message.id && !row.tempId),
  );
  // A duplicate id is not inserted again. Voice may still move pending → ready.
  if (already) return applyUpdate(base, message);

  const matched = flattenMessages(base).filter(
    (row) => row.id === message.id || row.tempId === message.id,
  );
  const incoming = adoptServerMessageFrom(matched, message);
  const pages = base.pages.map((page, index) => {
    const withoutId = page.messages.filter(
      (row) => row.id !== incoming.id && row.tempId !== incoming.id,
    );
    if (index !== 0) return { ...page, messages: withoutId };
    let dropIndex = -1;
    for (let cursor = withoutId.length - 1; cursor >= 0; cursor -= 1) {
      const row = withoutId[cursor];
      if (row && isPendingOptimisticMatch(row, incoming)) {
        dropIndex = cursor;
        break;
      }
    }
    const kept = withoutId.filter((_, cursor) => cursor !== dropIndex);
    return { ...page, messages: [incoming, ...kept] };
  });

  if (pages.length === 0) {
    return { pages: [{ messages: [incoming] }], pageParams: base.pageParams };
  }
  return { ...base, pages };
}

export function applyUpdate(
  data: ChatInfiniteData | undefined,
  message: ClientChatMessage,
): ChatInfiniteData {
  if (!data) return applyNew(undefined, message);
  let found = false;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((row) => {
      if (row.id === message.id || (row.tempId && row.tempId === message.id)) {
        found = true;
        return adoptServerMessage(row, message);
      }
      return row;
    }),
  }));
  if (!found) return applyNew(data, message);
  return { ...data, pages };
}

export function applyDelete(
  data: ChatInfiniteData | undefined,
  payload: { id: string },
): ChatInfiniteData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((row) =>
        row.id === payload.id ? { ...row, deleted: true, text: null, durationMs: null } : row,
      ),
    })),
  };
}

export function applyOptimistic(
  data: ChatInfiniteData | undefined,
  message: ClientChatMessage,
): ChatInfiniteData {
  const base = data?.pages.length ? data : emptyData();
  const pages = base.pages.map((page, index) => {
    const without = page.messages.filter(
      (row) => row.id !== message.id && row.tempId !== message.tempId,
    );
    if (index === 0) return { ...page, messages: [message, ...without] };
    return { ...page, messages: without };
  });
  return {
    pages,
    pageParams: base.pageParams.length ? base.pageParams : [undefined],
  };
}

export function replaceOptimistic(
  data: ChatInfiniteData | undefined,
  tempId: string,
  message: ClientChatMessage,
): ChatInfiniteData {
  if (!data) {
    return { pages: [{ messages: [cleanMessage(message)] }], pageParams: [undefined] };
  }

  const prior = flattenMessages(data).filter(
    (row) => row.id === message.id || row.tempId === tempId || row.id === tempId,
  );
  const real = adoptServerMessageFrom(prior, message);
  const already = data.pages.some((page) =>
    page.messages.some((row) => row.id === real.id && row.id !== tempId && !row.tempId),
  );
  const pages = data.pages.map((page, index) => {
    const withoutTemp = page.messages.filter((row) => row.id !== tempId && row.tempId !== tempId);
    if (already) {
      return {
        ...page,
        messages: withoutTemp.map((row) => (row.id === real.id ? real : row)),
      };
    }
    const withoutReal = withoutTemp.filter((row) => row.id !== real.id);
    if (index === 0) return { ...page, messages: [real, ...withoutReal] };
    return { ...page, messages: withoutReal };
  });
  return { ...data, pages: pages.length ? pages : [{ messages: [real] }] };
}

export function markOptimisticFailed(
  data: ChatInfiniteData | undefined,
  tempId: string,
): ChatInfiniteData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((row) =>
        row.id === tempId || row.tempId === tempId
          ? { ...row, sendFailed: true, sending: false }
          : row,
      ),
    })),
  };
}

export function removeMessage(
  data: ChatInfiniteData | undefined,
  id: string,
): ChatInfiniteData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((row) => row.id !== id && row.tempId !== id),
    })),
  };
}

function newestFirst(a: ClientChatMessage, b: ClientChatMessage): number {
  if (a.createdAt === b.createdAt) return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/**
 * Keep socket rows and in-flight optimistic rows when a latest-page refetch
 * returns a snapshot that started before those rows existed.
 */
export function mergeLatestPage(
  fetchedNewestFirst: ClientChatMessage[],
  current: { pages: Array<{ messages: ClientChatMessage[] }> } | undefined,
): ClientChatMessage[] {
  const fetchedIds = new Set(fetchedNewestFirst.map((row) => row.id));
  const newest = fetchedNewestFirst[0];
  const kept: ClientChatMessage[] = [];

  for (const row of flattenMessages(current)) {
    if (fetchedIds.has(row.id)) continue;
    if (row.tempId || row.sendFailed) {
      const delivered =
        !row.sendFailed &&
        fetchedNewestFirst.some(
          (item) =>
            item.type === "text" &&
            row.type === "text" &&
            item.sender.id === row.sender.id &&
            item.text === row.text,
        );
      if (!delivered) kept.push(row);
      continue;
    }
    if (!newest || row.createdAt > newest.createdAt) kept.push(row);
  }

  const locals = flattenMessages(current);
  const seen = new Set<string>();
  return [...kept, ...fetchedNewestFirst]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort(newestFirst)
    .map((row) => overlayInFlightVoice(row, locals));
}

/** A refetch of a pending voice must not drop the local file or the Sending state. */
function overlayInFlightVoice(
  row: ClientChatMessage,
  locals: ClientChatMessage[],
): ClientChatMessage {
  if (row.type !== "voice") return row;
  const local = locals.find(
    (item) => item.type === "voice" && (item.id === row.id || item.tempId === row.id),
  );
  if (!local) return row;
  const durationMs =
    row.durationMs != null && row.durationMs > 0
      ? row.durationMs
      : (local.durationMs ?? row.durationMs);
  if (local.sending && local.localUri && row.status === "pending") {
    return {
      ...row,
      durationMs,
      tempId: local.tempId,
      sending: true,
      localUri: local.localUri,
      localMimeType: local.localMimeType,
    };
  }
  if (durationMs !== row.durationMs) return { ...row, durationMs };
  return row;
}

function sameSenderGroup(previous: ClientChatMessage, message: ClientChatMessage): boolean {
  if (previous.deleted || message.deleted) return false;
  if (previous.sender.id !== message.sender.id) return false;
  if (dayKey(previous.createdAt) !== dayKey(message.createdAt)) return false;
  const gap = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return gap >= 0 && gap < CHAT_GROUP_GAP_MS;
}

/**
 * Newest-first rows for an inverted list. A group is consecutive messages from
 * one sender less than 5 minutes apart. `showTime` is set on the newest message
 * of that group (the visual bottom, which is earlier in this array).
 */
export function buildChatRows(
  messagesNewestFirst: ClientChatMessage[],
  options: { myUserId: string; now?: Date },
): ChatRow[] {
  const now = options.now ?? new Date();
  const oldestFirst = [...messagesNewestFirst].reverse();
  const rows: ChatRow[] = [];
  let previous: ClientChatMessage | null = null;

  for (const message of oldestFirst) {
    const key = dayKey(message.createdAt);
    if (!previous || dayKey(previous.createdAt) !== key) {
      rows.push({ type: "day", key: `day-${key}`, label: formatDayLabel(message.createdAt, now) });
    }
    const continues = Boolean(previous && sameSenderGroup(previous, message));
    rows.push({
      type: "message",
      key: message.tempId ?? message.id,
      message,
      showSender: message.sender.id !== options.myUserId && !message.deleted && !continues,
      grouped: continues,
      showTime: false,
    });
    previous = message;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.type !== "message") continue;
    let followedByGroupMate = false;
    for (let next = index + 1; next < rows.length; next += 1) {
      const candidate = rows[next];
      if (!candidate || candidate.type !== "message") continue;
      followedByGroupMate = candidate.grouped;
      break;
    }
    row.showTime = !followedByGroupMate || Boolean(row.message.sendFailed);
  }

  return rows.reverse();
}

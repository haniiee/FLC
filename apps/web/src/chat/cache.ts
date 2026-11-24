import type { ChatChannelKind, ChatMessage, GroupRole } from "@app/shared-types";
import { copy } from "../lib/copy";

export const CHAT_PAGE_SIZE = 50;

export type ClientChatMessage = ChatMessage & {
  /** Present while optimistic send is in flight or failed. */
  tempId?: string;
  sendFailed?: boolean;
  uploadProgress?: number;
};

export type ChatMessagesPage = {
  messages: ClientChatMessage[];
};

export type ChatInfiniteData = {
  pages: ChatMessagesPage[];
  pageParams: (string | undefined)[];
};

/** Newest-first flat list (API order). */
export function flattenMessages(data: ChatInfiniteData | undefined): ClientChatMessage[] {
  if (!data?.pages.length) return [];
  return data.pages.flatMap((page) => page.messages);
}

/** Oldest-first for rendering (top → bottom). */
export function messagesForDisplay(data: ChatInfiniteData | undefined): ClientChatMessage[] {
  return flattenMessages(data).slice().reverse();
}

export function applyNew(
  data: ChatInfiniteData | undefined,
  message: ClientChatMessage,
): ChatInfiniteData {
  const base: ChatInfiniteData = data ?? { pages: [{ messages: [] }], pageParams: [undefined] };
  const pages = base.pages.map((page) => ({
    messages: page.messages.filter((row) => row.id !== message.id),
  }));

  if (pages.length === 0) {
    return { pages: [{ messages: [message] }], pageParams: [undefined] };
  }

  const first = pages[0]!;
  // If an optimistic row with same real id already replaced, or duplicate event: skip insert if present
  if (first.messages.some((row) => row.id === message.id)) {
    return { ...base, pages };
  }

  // Drop matching optimistic temp if server event arrived first with same text/sender recently
  const withoutOptimisticDup = first.messages.filter((row) => {
    if (!row.tempId) return true;
    if (row.tempId === message.id) return false;
    if (
      row.type === "text" &&
      message.type === "text" &&
      row.sender.id === message.sender.id &&
      row.text === message.text &&
      !row.sendFailed
    ) {
      return false;
    }
    return true;
  });

  pages[0] = { messages: [message, ...withoutOptimisticDup] };
  return { ...base, pages };
}

export function applyUpdate(
  data: ChatInfiniteData | undefined,
  message: ClientChatMessage,
): ChatInfiniteData {
  if (!data) {
    return { pages: [{ messages: [message] }], pageParams: [undefined] };
  }
  let found = false;
  const pages = data.pages.map((page) => ({
    messages: page.messages.map((row) => {
      if (row.id === message.id || (row.tempId && row.tempId === message.id)) {
        found = true;
        return { ...message, tempId: undefined, sendFailed: undefined, uploadProgress: undefined };
      }
      return row;
    }),
  }));
  if (!found) {
    return applyNew(data, message);
  }
  return { ...data, pages };
}

export function applyDelete(
  data: ChatInfiniteData | undefined,
  payload: { id: string; channelId: string },
): ChatInfiniteData | undefined {
  if (!data) return data;
  const pages = data.pages.map((page) => ({
    messages: page.messages.map((row) =>
      row.id === payload.id
        ? {
            ...row,
            deleted: true,
            text: null,
            storageKey: undefined,
          }
        : row,
    ),
  }));
  return { ...data, pages };
}

/** Insert optimistic message at head of newest page. */
export function applyOptimistic(
  data: ChatInfiniteData | undefined,
  message: ClientChatMessage,
): ChatInfiniteData {
  const base: ChatInfiniteData = data ?? { pages: [{ messages: [] }], pageParams: [undefined] };
  const pages = base.pages.length
    ? base.pages.map((page, index) =>
        index === 0 ? { messages: [message, ...page.messages] } : page,
      )
    : [{ messages: [message] }];
  return {
    pages,
    pageParams: base.pageParams.length ? base.pageParams : [undefined],
  };
}

/**
 * Replace tempId row with server message. If the real message already exists
 * (event arrived first), just remove the temp row.
 */
export function replaceOptimistic(
  data: ChatInfiniteData | undefined,
  tempId: string,
  message: ClientChatMessage,
): ChatInfiniteData {
  if (!data) {
    return { pages: [{ messages: [message] }], pageParams: [undefined] };
  }

  const alreadyHasReal = flattenMessages(data).some((row) => row.id === message.id && !row.tempId);

  const pages = data.pages.map((page) => ({
    messages: page.messages
      .filter((row) => {
        if (row.id === tempId || row.tempId === tempId) {
          return !alreadyHasReal;
        }
        return true;
      })
      .map((row) => {
        if (row.id === tempId || row.tempId === tempId) {
          return {
            ...message,
            tempId: undefined,
            sendFailed: undefined,
            uploadProgress: undefined,
          };
        }
        return row;
      }),
  }));

  if (alreadyHasReal) {
    return { ...data, pages };
  }

  // Ensure message is present (in case temp wasn't found)
  const stillMissing = !flattenMessages({ ...data, pages }).some((row) => row.id === message.id);
  if (stillMissing) {
    return applyNew({ ...data, pages }, message);
  }
  return { ...data, pages };
}

export function markOptimisticFailed(
  data: ChatInfiniteData | undefined,
  tempId: string,
): ChatInfiniteData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      messages: page.messages.map((row) =>
        row.id === tempId || row.tempId === tempId ? { ...row, sendFailed: true } : row,
      ),
    })),
  };
}

export function getNextPageParam(
  lastPage: ChatMessagesPage,
  limit = CHAT_PAGE_SIZE,
): string | undefined {
  if (lastPage.messages.length < limit) {
    return undefined;
  }
  const last = lastPage.messages[lastPage.messages.length - 1];
  return last?.id;
}

export function canDeleteMessage(input: {
  myUserId: string;
  myRole: GroupRole;
  channelKind: ChatChannelKind;
  senderId: string;
}): boolean {
  if (input.senderId === input.myUserId) {
    return true;
  }
  if (input.channelKind === "all" && (input.myRole === "teacher" || input.myRole === "assistant")) {
    return true;
  }
  return false;
}

export function channelTitle(kind: ChatChannelKind): string {
  return kind === "all" ? copy.chat.allChannel : copy.chat.studentsChannel;
}

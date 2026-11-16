"use client";

import type { ChatChannelKind } from "@app/shared-types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  applyOptimistic,
  applyUpdate,
  CHAT_PAGE_SIZE,
  channelTitle,
  getNextPageParam,
  markOptimisticFailed,
  replaceOptimistic,
  type ChatInfiniteData,
  type ClientChatMessage,
} from "../../../../../chat/cache";
import { chatChannelsQueryKey, chatMessagesQueryKey } from "../../../../../chat/query-keys";
import { uploadChatVoice } from "../../../../../chat/upload-chat-voice";
import { ChatComposer } from "../../../../../components/chat/ChatComposer";
import { ConnectionBanner } from "../../../../../components/chat/ConnectionBanner";
import { MessageList } from "../../../../../components/chat/MessageList";
import { Spinner } from "../../../../../components/ui/Spinner";
import { EmptyState } from "../../../../../components/ui/EmptyState";
import { getApiClient } from "../../../../../lib/api";
import { apiErrorMessage } from "../../../../../lib/format";
import { useAuth } from "../../../../../providers/auth-provider";
import { useChannel } from "../../../../../realtime/useChannel";
import type { RecorderResult } from "../../../../../recorder/useRecorder";

export default function ChatChannelPage() {
  const params = useParams<{ groupId: string; channelId: string }>();
  const groupId = params.groupId;
  const channelId = params.channelId;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { connected } = useChannel(channelId);
  const [replyTo, setReplyTo] = useState<ClientChatMessage | null>(null);

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId),
  });

  const channelsQuery = useQuery({
    queryKey: chatChannelsQueryKey(groupId),
    queryFn: () => getApiClient().listChats(groupId),
  });

  const channel = channelsQuery.data?.channels.find((c) => c.id === channelId);
  const channelKind = (channel?.kind ?? "all") as ChatChannelKind;

  const messagesQuery = useInfiniteQuery({
    queryKey: chatMessagesQueryKey(channelId),
    queryFn: async ({ pageParam }) => {
      const result = await getApiClient().listChatMessages(channelId, {
        before: pageParam,
        limit: CHAT_PAGE_SIZE,
      });
      return { messages: result.messages as ClientChatMessage[] };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => getNextPageParam(lastPage, CHAT_PAGE_SIZE),
    enabled: Boolean(channelId),
  });

  const data = messagesQuery.data as ChatInfiniteData | undefined;

  const patchCache = useCallback(
    (updater: (prev: ChatInfiniteData | undefined) => ChatInfiniteData | undefined) => {
      queryClient.setQueryData<ChatInfiniteData>(chatMessagesQueryKey(channelId), updater);
    },
    [channelId, queryClient],
  );

  const sendText = useCallback(
    async (text: string, replyToId?: string | null, tempId?: string) => {
      if (!user) return;
      const id = tempId ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ClientChatMessage = {
        id,
        tempId: id,
        channelId,
        type: "text",
        text,
        durationMs: null,
        status: "ready",
        replyToId: replyToId ?? null,
        createdAt: new Date().toISOString(),
        deleted: false,
        sender: {
          id: user.id,
          displayName: user.displayName,
          role: groupQuery.data?.myRole ?? "student",
        },
      };

      if (!tempId) {
        patchCache((prev) => applyOptimistic(prev, optimistic));
      }

      try {
        const real = await getApiClient().sendChatText(channelId, {
          text,
          replyToId: replyToId ?? undefined,
        });
        patchCache((prev) => replaceOptimistic(prev, id, real));
        setReplyTo(null);
      } catch (error) {
        patchCache((prev) => markOptimisticFailed(prev, id));
        toast.error(apiErrorMessage(error, "ارسال ناموفق بود"));
      }
    },
    [channelId, groupQuery.data?.myRole, patchCache, user],
  );

  const sendVoice = useCallback(
    async (result: RecorderResult) => {
      if (!user) return;
      const tempId = `temp-voice-${Date.now()}`;
      const optimistic: ClientChatMessage = {
        id: tempId,
        tempId,
        channelId,
        type: "voice",
        text: null,
        mimeType: result.mimeType,
        sizeBytes: result.blob.size,
        durationMs: null,
        status: "pending",
        replyToId: replyTo?.id ?? null,
        createdAt: new Date().toISOString(),
        deleted: false,
        uploadProgress: 0,
        sender: {
          id: user.id,
          displayName: user.displayName,
          role: groupQuery.data?.myRole ?? "student",
        },
      };
      patchCache((prev) => applyOptimistic(prev, optimistic));

      try {
        const completed = await uploadChatVoice({
          channelId,
          blob: result.blob,
          mimeType: result.mimeType,
          onProgress: (progress) => {
            patchCache((prev) =>
              applyUpdate(prev, { ...optimistic, uploadProgress: progress, status: "pending" }),
            );
          },
        });
        patchCache((prev) => replaceOptimistic(prev, tempId, completed));
        setReplyTo(null);
      } catch (error) {
        patchCache((prev) => markOptimisticFailed(prev, tempId));
        toast.error(apiErrorMessage(error, "ارسال ویس ناموفق بود"));
      }
    },
    [channelId, groupQuery.data?.myRole, patchCache, replyTo?.id, user],
  );

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => getApiClient().deleteChatMessage(messageId),
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const title = useMemo(() => channelTitle(channelKind), [channelKind]);

  if (groupQuery.isLoading || channelsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!groupQuery.data || !channel) {
    return <EmptyState title="چت پیدا نشد" />;
  }

  if (!user) {
    return <EmptyState title="برای چت وارد شوید" />;
  }

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-64px)] flex-col">
      <div className="border-b border-border px-3 py-2">
        <Link href={`/groups/${groupId}`} className="text-xs text-text-muted">
          → بازگشت
        </Link>
        <h1 className="text-lg font-bold text-secondary">{groupQuery.data.name}</h1>
        <p className="text-sm text-text-muted">{title}</p>
      </div>

      <ConnectionBanner connected={connected} />

      <MessageList
        data={data}
        myUserId={user.id}
        myRole={groupQuery.data.myRole}
        channelKind={channelKind}
        hasNextPage={messagesQuery.hasNextPage}
        isFetchingNextPage={messagesQuery.isFetchingNextPage}
        onLoadOlder={() => {
          void messagesQuery.fetchNextPage();
        }}
        onReply={(message) => setReplyTo(message)}
        onDelete={(message) => {
          if (!window.confirm("این پیام حذف شود؟")) return;
          void deleteMutation.mutateAsync(message.id);
        }}
        onRetry={(message) => {
          if (message.type === "text" && message.text) {
            void sendText(message.text, message.replyToId, message.tempId ?? message.id);
          }
        }}
      />

      <ChatComposer
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onSendText={(text) => void sendText(text, replyTo?.id)}
        onSendVoice={(result) => void sendVoice(result)}
      />
    </div>
  );
}

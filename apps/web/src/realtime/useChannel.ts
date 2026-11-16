"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, MessageDeletedEvent } from "@app/shared-types";
import { applyDelete, applyNew, applyUpdate, type ChatInfiniteData } from "../chat/cache";
import { chatMessagesQueryKey } from "../chat/query-keys";
import { joinChannel, leaveChannel, subscribeSocketStatus } from "./socket";

export function useChannel(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({
    onNew: (message: ChatMessage) => {
      if (!channelId || message.channelId !== channelId) return;
      queryClient.setQueryData<ChatInfiniteData>(chatMessagesQueryKey(channelId), (prev) =>
        applyNew(prev, message),
      );
    },
    onUpdated: (message: ChatMessage) => {
      if (!channelId || message.channelId !== channelId) return;
      queryClient.setQueryData<ChatInfiniteData>(chatMessagesQueryKey(channelId), (prev) =>
        applyUpdate(prev, message),
      );
    },
    onDeleted: (payload: MessageDeletedEvent) => {
      if (!channelId || payload.channelId !== channelId) return;
      queryClient.setQueryData<ChatInfiniteData>(chatMessagesQueryKey(channelId), (prev) =>
        applyDelete(prev, payload),
      );
    },
    onResync: () => {
      if (!channelId) return;
      void queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(channelId) });
    },
  });

  useEffect(() => subscribeSocketStatus(setConnected), []);

  useEffect(() => {
    if (!channelId) return;
    const handlers = handlersRef.current;
    let cancelled = false;

    void joinChannel(channelId, handlers).catch(() => {
      if (!cancelled) setConnected(false);
    });

    return () => {
      cancelled = true;
      void leaveChannel(channelId, handlers);
    };
  }, [channelId]);

  return { connected };
}

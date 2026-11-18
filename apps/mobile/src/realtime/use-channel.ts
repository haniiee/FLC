import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ChatMessage, MessageDeletedEvent } from "@app/shared-types";
import {
  applyDelete,
  applyNew,
  applyUpdate,
  chatMessagesQueryKey,
  type ChatInfiniteData,
} from "../lib/chat-logic";
import { joinChannel, leaveChannel, subscribeSocketStatus } from "./socket";

export function useChannel(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => subscribeSocketStatus(setConnected), []);

  useEffect(() => {
    if (!channelId) return;
    const key = chatMessagesQueryKey(channelId);
    const handlers = {
      onNew: (message: ChatMessage) => {
        if (message.channelId !== channelId) return;
        queryClient.setQueryData<ChatInfiniteData>(key, (prev) => applyNew(prev, message));
      },
      onUpdated: (message: ChatMessage) => {
        if (message.channelId !== channelId) return;
        queryClient.setQueryData<ChatInfiniteData>(key, (prev) => applyUpdate(prev, message));
      },
      onDeleted: (payload: MessageDeletedEvent) => {
        if (payload.channelId !== channelId) return;
        queryClient.setQueryData<ChatInfiniteData>(key, (prev) => applyDelete(prev, payload));
      },
      onResync: () => {
        void queryClient.invalidateQueries({ queryKey: key });
      },
    };

    let cancelled = false;
    void joinChannel(channelId, handlers).catch(() => {
      if (!cancelled) setConnected(false);
    });

    return () => {
      cancelled = true;
      void leaveChannel(channelId, handlers);
    };
  }, [channelId, queryClient]);

  return { connected };
}

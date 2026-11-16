"use client";

import type { ChatChannelKind, GroupRole } from "@app/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  messagesForDisplay,
  type ChatInfiniteData,
  type ClientChatMessage,
} from "../../chat/cache";
import { groupMessagesByDay } from "../../chat/day-groups";
import { MessageBubble } from "./MessageBubble";

const NEAR_BOTTOM_PX = 120;

export function MessageList({
  data,
  myUserId,
  myRole,
  channelKind,
  hasNextPage,
  isFetchingNextPage,
  onLoadOlder,
  onReply,
  onDelete,
  onRetry,
  highlightId,
}: {
  data: ChatInfiniteData | undefined;
  myUserId: string;
  myRole: GroupRole;
  channelKind: ChatChannelKind;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadOlder: () => void;
  onReply: (message: ClientChatMessage) => void;
  onDelete: (message: ClientChatMessage) => void;
  onRetry: (message: ClientChatMessage) => void;
  highlightId?: string | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const prevNewestId = useRef<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const display = useMemo(() => messagesForDisplay(data), [data]);
  const byId = useMemo(() => new Map(display.map((m) => [m.id, m])), [display]);
  const groups = useMemo(() => groupMessagesByDay(display), [display]);
  const newestId = display[display.length - 1]?.id ?? null;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < NEAR_BOTTOM_PX;
    setShowJump(!stickToBottom.current);

    if (el.scrollTop < 80 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      onLoadOlder();
      requestAnimationFrame(() => {
        const node = scrollerRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight - prevHeight + prevTop;
      });
    }
  };

  useEffect(() => {
    if (!newestId) return;
    if (prevNewestId.current && prevNewestId.current !== newestId) {
      if (stickToBottom.current) {
        scrollToBottom("smooth");
      } else {
        setShowJump(true);
      }
    } else if (!prevNewestId.current) {
      scrollToBottom("auto");
    }
    prevNewestId.current = newestId;
  }, [newestId, scrollToBottom]);

  useEffect(() => {
    if (!highlightId) return;
    const node = document.getElementById(`chat-msg-${highlightId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(highlightId);
      const timer = setTimeout(() => setFlashId(null), 1600);
      return () => clearTimeout(timer);
    }
  }, [highlightId]);

  const scrollToReply = (id: string) => {
    const node = document.getElementById(`chat-msg-${id}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1600);
    }
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full space-y-3 overflow-y-auto px-3 py-3"
      >
        {isFetchingNextPage ? (
          <p className="text-center text-xs text-text-muted">بارگذاری پیام‌های قبلی…</p>
        ) : null}
        {groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <div className="sticky top-0 z-10 flex justify-center">
              <span className="rounded-full bg-surface/95 px-3 py-0.5 text-[11px] text-text-muted shadow-sm">
                {group.label}
              </span>
            </div>
            {group.messages.map((message) => (
              <MessageBubble
                key={message.tempId ?? message.id}
                message={message}
                mine={message.sender.id === myUserId}
                myUserId={myUserId}
                myRole={myRole}
                channelKind={channelKind}
                replyPreview={message.replyToId ? byId.get(message.replyToId) : null}
                highlighted={flashId === message.id}
                onReply={() => onReply(message)}
                onDelete={() => onDelete(message)}
                onRetry={() => onRetry(message)}
                onScrollToReply={scrollToReply}
              />
            ))}
          </div>
        ))}
      </div>

      {showJump ? (
        <button
          type="button"
          className="absolute bottom-3 start-1/2 z-10 -translate-x-1/2 rounded-full bg-secondary px-3 py-1.5 text-xs text-white shadow-lg"
          onClick={() => {
            stickToBottom.current = true;
            setShowJump(false);
            scrollToBottom("smooth");
          }}
        >
          پیام جدید ↓
        </button>
      ) : null}
    </div>
  );
}

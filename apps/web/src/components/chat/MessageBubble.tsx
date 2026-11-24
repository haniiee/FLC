"use client";

import type { ChatChannelKind, GroupRole } from "@app/shared-types";
import { useEffect, useRef, useState } from "react";
import { canDeleteMessage, type ClientChatMessage } from "../../chat/cache";
import { formatMessageTime } from "../../chat/day-groups";
import { linkifyText } from "../../chat/linkify";
import { copy } from "../../lib/copy";
import { roleLabel } from "../../lib/format";
import { VoiceMessageBubble } from "./VoiceMessageBubble";

export function MessageBubble({
  message,
  mine,
  myUserId,
  myRole,
  channelKind,
  replyPreview,
  highlighted,
  onReply,
  onDelete,
  onRetry,
  onScrollToReply,
}: {
  message: ClientChatMessage;
  mine: boolean;
  myUserId: string;
  myRole: GroupRole;
  channelKind: ChatChannelKind;
  replyPreview?: ClientChatMessage | null;
  highlighted?: boolean;
  onReply: () => void;
  onDelete: () => void;
  onRetry?: () => void;
  onScrollToReply?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const showDelete = canDeleteMessage({
    myUserId,
    myRole,
    channelKind,
    senderId: message.sender.id,
  });

  const showSenderMeta = !mine;
  const roleBadge =
    message.sender.role === "teacher" || message.sender.role === "assistant"
      ? roleLabel(message.sender.role)
      : null;

  return (
    <div
      ref={rootRef}
      id={`chat-msg-${message.id}`}
      className={`group relative flex ${mine ? "justify-end" : "justify-start"}`}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      onTouchStart={() => {
        longPressTimer.current = setTimeout(() => setMenuOpen(true), 500);
      }}
      onTouchEnd={() => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }}
      onTouchMove={() => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 shadow-card transition ring-offset-2 ${
          mine
            ? "rounded-br-sm bg-secondary/15 text-text"
            : "rounded-bl-sm border border-border bg-surface"
        } ${highlighted ? "ring-2 ring-primary" : ""}`}
      >
        {showSenderMeta ? (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-secondary" dir="auto">
              {message.sender.displayName}
            </span>
            {roleBadge ? (
              <span className="rounded-md bg-secondary/10 px-1.5 py-0.5 text-[10px] font-medium text-secondary">
                {roleBadge}
              </span>
            ) : null}
          </div>
        ) : null}

        {replyPreview ? (
          <button
            type="button"
            className="mb-2 w-full rounded-md border-s-2 border-secondary bg-surface-muted/50 px-2 py-1 text-start"
            onClick={() => onScrollToReply?.(replyPreview.id)}
          >
            <p className="truncate text-[11px] font-medium text-secondary" dir="auto">
              {replyPreview.sender.displayName}
            </p>
            <p className="truncate text-xs text-text-muted" dir="auto">
              {replyPreview.deleted
                ? copy.chat.messageDeleted
                : replyPreview.type === "voice"
                  ? copy.chat.voiceMessage
                  : (replyPreview.text ?? "")}
            </p>
          </button>
        ) : null}

        {message.deleted ? (
          <p className="text-sm italic text-text-muted">{copy.chat.messageDeleted}</p>
        ) : message.type === "voice" ? (
          <VoiceMessageBubble message={message} />
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-text" dir="auto">
            {linkifyText(message.text ?? "")}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[10px] text-text-muted">
            <bdi dir="ltr">{formatMessageTime(message.createdAt)}</bdi>
          </span>
          {message.sendFailed ? (
            <button type="button" className="text-[10px] font-medium text-danger" onClick={onRetry}>
              {copy.chat.tryAgain}
            </button>
          ) : null}
          <button
            type="button"
            className="hidden text-xs text-text-muted opacity-0 transition group-hover:opacity-100 md:inline"
            aria-label={copy.chat.moreMenu}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
        </div>

        {menuOpen && !message.deleted ? (
          <div className="absolute bottom-full z-20 mb-1 min-w-[8rem] rounded-lg border border-border bg-surface p-1 shadow-card">
            <button
              type="button"
              className="block w-full rounded-md px-3 py-1.5 text-start text-sm hover:bg-surface-muted"
              onClick={() => {
                setMenuOpen(false);
                onReply();
              }}
            >
              {copy.chat.reply}
            </button>
            {message.type === "text" && message.text ? (
              <button
                type="button"
                className="block w-full rounded-md px-3 py-1.5 text-start text-sm hover:bg-surface-muted"
                onClick={() => {
                  setMenuOpen(false);
                  void navigator.clipboard?.writeText(message.text ?? "");
                }}
              >
                {copy.chat.copy}
              </button>
            ) : null}
            {showDelete ? (
              <button
                type="button"
                className="block w-full rounded-md px-3 py-1.5 text-start text-sm text-danger hover:bg-surface-muted"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                {copy.content.delete}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

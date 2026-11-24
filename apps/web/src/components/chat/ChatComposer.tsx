"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientChatMessage } from "../../chat/cache";
import { copy } from "../../lib/copy";
import type { RecorderResult } from "../../recorder/useRecorder";
import { HoldToRecordButton } from "../recorder/HoldToRecordButton";

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function ChatComposer({
  replyTo,
  onClearReply,
  onSendText,
  onSendVoice,
  disabled,
}: {
  replyTo: ClientChatMessage | null;
  onClearReply: () => void;
  onSendText: (text: string) => void;
  onSendVoice: (result: RecorderResult) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [coarse, setCoarse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCoarse(isCoarsePointer());
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 5 * 24;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [text]);

  const trimmed = text.trim();
  const showMic = trimmed.length === 0;

  const replyLabel = useMemo(() => {
    if (!replyTo) return null;
    if (replyTo.deleted) return copy.chat.messageDeleted;
    if (replyTo.type === "voice") return copy.chat.voiceMessage;
    return replyTo.text ?? "";
  }, [replyTo]);

  return (
    <div className="border-t border-border bg-surface px-3 py-2 shadow-card">
      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-surface-muted/60 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-secondary" dir="auto">
              {replyTo.sender.displayName}
            </p>
            <p className="truncate text-xs text-text-muted" dir="auto">
              {replyLabel}
            </p>
          </div>
          <button
            type="button"
            className="text-text-muted"
            aria-label={copy.chat.cancelReply}
            onClick={onClearReply}
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          dir="auto"
          disabled={disabled}
          value={text}
          placeholder={copy.chat.messagePlaceholder}
          className="max-h-[7.5rem] min-h-[2.75rem] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-primary-soft"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (coarse) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!trimmed || disabled) return;
              onSendText(trimmed);
              setText("");
            }
          }}
        />

        {showMic ? (
          <HoldToRecordButton
            fixed={false}
            className="!h-11 !w-11 !text-xl"
            onSend={(result) => {
              if (!disabled) onSendVoice(result);
            }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled || !trimmed}
            aria-label={copy.chat.send}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg text-on-primary shadow-card disabled:opacity-50"
            onClick={() => {
              if (!trimmed) return;
              onSendText(trimmed);
              setText("");
            }}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ClientChatMessage } from "../../chat/cache";
import { formatDuration, apiErrorMessage } from "../../lib/format";
import { getApiClient } from "../../lib/api";
import { usePlayer } from "../../player/context";
import { usePlayerStore, selectCurrentItem } from "../../player/store";

export function VoiceMessageBubble({ message }: { message: ClientChatMessage }) {
  const player = usePlayer();
  const fileId = `chat:${message.id}`;
  const current = usePlayerStore(selectCurrentItem);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const isCurrent = current?.fileId === fileId;
  const [loading, setLoading] = useState(false);

  const progress =
    isCurrent && (duration > 0 || (message.durationMs ?? 0) > 0)
      ? position / (duration || (message.durationMs ?? 0) / 1000)
      : 0;

  const onToggle = useCallback(async () => {
    if (message.status === "processing" || message.status === "failed" || message.deleted) {
      return;
    }
    if (isCurrent) {
      player.toggle();
      return;
    }
    setLoading(true);
    try {
      const { url } = await getApiClient().getChatMessageUrl(message.id);
      await player.playChatVoice({
        messageId: message.id,
        url,
        senderName: message.sender.displayName,
        durationMs: message.durationMs,
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "پخش ناموفق بود"));
    } finally {
      setLoading(false);
    }
  }, [isCurrent, message, player]);

  useEffect(() => {
    // no-op: keeps progress subscribed while current
  }, [isCurrent, position]);

  if (message.status === "processing") {
    return <p className="text-sm text-text-muted">در حال پردازش…</p>;
  }
  if (message.status === "failed") {
    return <p className="text-sm text-danger">خطا</p>;
  }
  if (typeof message.uploadProgress === "number" && message.uploadProgress < 1) {
    return (
      <p className="text-sm text-text-muted">
        در حال ارسال… <bdi dir="ltr">{Math.round(message.uploadProgress * 100)}%</bdi>
      </p>
    );
  }

  return (
    <div className="flex min-w-[12rem] items-center gap-2">
      <button
        type="button"
        aria-label={isCurrent && isPlaying ? "توقف" : "پخش"}
        disabled={loading || message.deleted}
        onClick={() => void onToggle()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm text-white disabled:opacity-50"
      >
        {isCurrent && isPlaying ? "❚❚" : "▶"}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-secondary transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          <bdi dir="ltr">{formatDuration(message.durationMs) || "0:00"}</bdi>
        </p>
      </div>
    </div>
  );
}

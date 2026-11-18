import type { ChatMessage } from "@app/shared-types";
import type { ChatInfiniteData, ClientChatMessage } from "./chat-logic";
import { MIN_RECORD_MS, formatRecTimer } from "./record-logic";

/** Chat voice stops and sends itself at five minutes. Topic recordings stay at ten. */
export const CHAT_VOICE_MAX_MS = 5 * 60 * 1000;

export type VoiceHoldDecision = "cancel" | "discard" | "send";

/**
 * What a finished hold should do.
 * Cancel deletes the file with no toast. A missing file or a hold under 1s
 * is a discard (toast, no upload). Anything else is sent.
 */
export function decideVoiceHold(input: {
  cancelled: boolean;
  durationMs: number;
  hasFile: boolean;
}): VoiceHoldDecision {
  if (input.cancelled) return "cancel";
  if (!input.hasFile || input.durationMs < MIN_RECORD_MS) return "discard";
  return "send";
}

export type VoiceBubblePhase =
  "deleted" | "upload-failed" | "sending" | "processing" | "process-failed" | "ready";

/** Which voice bubble to draw. Upload failure is separate from a server transcode failure. */
export function voiceBubblePhase(
  message: Pick<ClientChatMessage, "deleted" | "sendFailed" | "sending" | "tempId" | "status">,
): VoiceBubblePhase {
  if (message.deleted) return "deleted";
  if (message.sendFailed) return "upload-failed";
  if (message.sending || (Boolean(message.tempId) && message.status === "pending")) {
    return "sending";
  }
  if (message.status === "pending" || message.status === "processing") return "processing";
  if (message.status === "failed") return "process-failed";
  return "ready";
}

export function createOptimisticVoice(input: {
  clientId: string;
  channelId: string;
  durationMs: number;
  mimeType: string;
  localUri: string;
  sender: ChatMessage["sender"];
  now?: Date;
}): ClientChatMessage {
  return {
    id: input.clientId,
    tempId: input.clientId,
    channelId: input.channelId,
    type: "voice",
    text: null,
    mimeType: input.mimeType,
    durationMs: input.durationMs,
    status: "pending",
    replyToId: null,
    createdAt: (input.now ?? new Date()).toISOString(),
    deleted: false,
    sender: input.sender,
    sendFailed: false,
    sending: true,
    localUri: input.localUri,
    localMimeType: input.mimeType,
  };
}

/** Point the optimistic row at the real message id while the local file is still uploading. */
export function bindVoiceUploadId(
  data: ChatInfiniteData | undefined,
  tempId: string,
  messageId: string,
): ChatInfiniteData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((row) =>
        row.tempId === tempId || row.id === tempId
          ? { ...row, id: messageId, sending: true, sendFailed: false }
          : row,
      ),
    })),
  };
}

/** Put a failed voice row back on its temp id so a server delete cannot mark the bubble deleted. */
export function failVoiceUpload(
  data: ChatInfiniteData | undefined,
  tempId: string,
): { data: ChatInfiniteData | undefined; orphanMessageId?: string } {
  if (!data) return { data };
  let orphanMessageId: string | undefined;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((row) => {
      if (row.tempId !== tempId && row.id !== tempId) return row;
      if (!row.id.startsWith("temp-") && row.id !== tempId) orphanMessageId = row.id;
      return {
        ...row,
        id: row.tempId ?? row.id,
        sendFailed: true,
        sending: false,
        status: "pending" as const,
      };
    }),
  }));
  return { data: { ...data, pages }, orphanMessageId };
}

/** Retry uses the same local file. The next upload-url binds a new server id. */
export function beginVoiceRetry(
  data: ChatInfiniteData | undefined,
  tempId: string,
): ChatInfiniteData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((row) =>
        row.tempId === tempId || row.id === tempId
          ? {
              ...row,
              id: row.tempId ?? row.id,
              sendFailed: false,
              sending: true,
              status: "pending" as const,
            }
          : row,
      ),
    })),
  };
}

export type CachedVoiceUrl = {
  url: string;
  expiresAt: number;
};

/** Refresh a little before the signed URL actually expires. */
export function cacheVoiceUrl(url: string, expiresInSec: number, now: number): CachedVoiceUrl {
  const skewSec = 15;
  const ttlMs = Math.max(0, expiresInSec - skewSec) * 1000;
  return { url, expiresAt: now + ttlMs };
}

export function isVoiceUrlFresh(entry: CachedVoiceUrl | undefined, now: number): boolean {
  return Boolean(entry && entry.expiresAt > now);
}

export type VoicePlaybackClock = {
  currentMs: number;
  totalMs: number;
  ratio: number;
  label: string;
};

/**
 * Clock for the voice bubble. `currentTimeSec` and `durationSec` are expo-audio
 * seconds. `durationMs` is the message length. The bar and the label both use
 * this result. An inactive message (finished, or another voice took over) sits at 0.
 */
export function voicePlaybackClock(input: {
  active: boolean;
  currentTimeSec: number;
  durationSec?: number;
  durationMs?: number | null;
}): VoicePlaybackClock {
  const messageMs = input.durationMs != null && input.durationMs > 0 ? input.durationMs : 0;
  const playerMs =
    input.durationSec != null && Number.isFinite(input.durationSec) && input.durationSec > 0
      ? Math.round(input.durationSec * 1000)
      : 0;
  const totalMs = messageMs || playerMs;
  const seconds =
    input.active && Number.isFinite(input.currentTimeSec) ? Math.max(0, input.currentTimeSec) : 0;
  const rawMs = seconds * 1000;
  const currentMs = totalMs > 0 ? Math.min(rawMs, totalMs) : rawMs;
  const ratio = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;
  return {
    currentMs,
    totalMs,
    ratio,
    label: `${formatRecTimer(currentMs)} / ${formatRecTimer(totalMs)}`,
  };
}

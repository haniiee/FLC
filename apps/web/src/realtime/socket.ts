"use client";

import type { ChatMessage, MessageDeletedEvent } from "@app/shared-types";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "../lib/supabase/browser";

type StatusListener = (connected: boolean) => void;
const statusListeners = new Set<StatusListener>();

type ChannelHandlers = {
  onNew?: (message: ChatMessage) => void;
  onUpdated?: (message: ChatMessage) => void;
  onDeleted?: (payload: MessageDeletedEvent) => void;
  onResync?: () => void;
};

const channelHandlers = new Map<string, Set<ChannelHandlers>>();
const channelRefCounts = new Map<string, number>();
const activeChannels = new Set<string>();

let supabase: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let connected = false;

function getSupabase() {
  if (!supabase) supabase = createBrowserSupabaseClient();
  return supabase;
}

function emitStatus(value: boolean) {
  connected = value;
  for (const listener of statusListeners) listener(value);
}

function mapRow(row: Record<string, unknown>): ChatMessage {
  const deleted = Boolean(row.deleted_at);
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    type: row.type as ChatMessage["type"],
    text: deleted ? null : ((row.text as string | null) ?? null),
    mimeType: (row.mime_type as string | null) ?? undefined,
    sizeBytes: (row.size_bytes as number | null) ?? undefined,
    durationMs: (row.duration_ms as number | null) ?? null,
    status: (row.status as ChatMessage["status"]) ?? "ready",
    processingError: (row.processing_error as string | null) ?? undefined,
    replyToId: (row.reply_to_id as string | null) ?? null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    deleted,
    sender: {
      id: String(row.sender_id),
      displayName: "…",
      role: "student",
    },
  };
}

function ensureRealtime() {
  if (realtimeChannel) return;
  const client = getSupabase();
  realtimeChannel = client
    .channel("chat-messages")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_messages" },
      (payload) => {
        const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
        if (!row?.channel_id) return;
        const channelId = String(row.channel_id);
        if (!activeChannels.has(channelId)) return;
        const handlers = channelHandlers.get(channelId);
        if (!handlers) return;
        // Payload rows lack joined sender/role — resync from API for correct ChatMessage DTOs.
        if (payload.eventType === "DELETE" && payload.old) {
          for (const h of handlers) {
            h.onDeleted?.({ id: String((payload.old as { id: string }).id), channelId });
          }
        } else if (payload.eventType === "UPDATE" && payload.new) {
          const message = mapRow(payload.new as Record<string, unknown>);
          if (message.deleted) {
            for (const h of handlers) h.onDeleted?.({ id: message.id, channelId });
          } else {
            for (const h of handlers) h.onResync?.();
          }
        } else {
          for (const h of handlers) h.onResync?.();
        }
      },
    )
    .subscribe((status) => {
      emitStatus(status === "SUBSCRIBED");
    });
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(connected);
  return () => statusListeners.delete(listener);
}

export async function getSocket(): Promise<{ connected: boolean }> {
  ensureRealtime();
  return { connected };
}

export function isSocketConnected(): boolean {
  return connected;
}

export async function joinChannel(channelId: string, handlers: ChannelHandlers): Promise<void> {
  ensureRealtime();
  activeChannels.add(channelId);
  channelRefCounts.set(channelId, (channelRefCounts.get(channelId) ?? 0) + 1);
  if (!channelHandlers.has(channelId)) channelHandlers.set(channelId, new Set());
  channelHandlers.get(channelId)!.add(handlers);
}

export async function leaveChannel(channelId: string, handlers?: ChannelHandlers): Promise<void> {
  if (handlers) channelHandlers.get(channelId)?.delete(handlers);
  const next = (channelRefCounts.get(channelId) ?? 1) - 1;
  if (next <= 0) {
    channelRefCounts.delete(channelId);
    activeChannels.delete(channelId);
    channelHandlers.delete(channelId);
  } else {
    channelRefCounts.set(channelId, next);
  }
}

export function disconnectSocket(): void {
  if (realtimeChannel) {
    void getSupabase().removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  activeChannels.clear();
  channelHandlers.clear();
  channelRefCounts.clear();
  emitStatus(false);
}

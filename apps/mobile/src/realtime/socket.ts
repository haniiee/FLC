import type { ChatMessage, MessageDeletedEvent } from "@app/shared-types";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";

type StatusListener = (connected: boolean) => void;
type ChannelHandlers = {
  onNew?: (message: ChatMessage) => void;
  onUpdated?: (message: ChatMessage) => void;
  onDeleted?: (payload: MessageDeletedEvent) => void;
  onResync?: () => void;
};

const activeChannels = new Set<string>();
const channelRefCounts = new Map<string, number>();
const channelHandlers = new Map<string, Set<ChannelHandlers>>();
const statusListeners = new Set<StatusListener>();

let supabase: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let connected = false;
let backgrounded = false;
let unauthorizedHandler: (() => void) | null = null;

function supabaseConfig() {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    (Constants.expoConfig?.extra?.supabaseUrl as string | undefined);
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined);
  if (!url || !anonKey) throw new Error("Supabase env missing for mobile realtime");
  return { url, anonKey };
}

function getSupabase() {
  if (!supabase) {
    const cfg = supabaseConfig();
    supabase = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return supabase;
}

function emitStatus(value: boolean) {
  connected = value;
  for (const listener of statusListeners) listener(value && !backgrounded);
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
    .subscribe((status) => emitStatus(status === "SUBSCRIBED"));
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(connected && !backgrounded);
  return () => statusListeners.delete(listener);
}

export function setSocketUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
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

AppState.addEventListener("change", (state: AppStateStatus) => {
  backgrounded = state !== "active";
  emitStatus(connected);
});

void unauthorizedHandler;

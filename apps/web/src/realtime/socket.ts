"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ChatClientToServerEvents,
  ChatMessage,
  ChatServerToClientEvents,
  MessageDeletedEvent,
} from "@app/shared-types";
import { getApiClient } from "../lib/api";
import { webTokenStore } from "../lib/token-store";

/** ListenEvents = server→client, EmitEvents = client→server */
type AppSocket = Socket<ChatServerToClientEvents, ChatClientToServerEvents>;

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: AppSocket | null = null;
let connecting: Promise<AppSocket> | null = null;
let refreshAttempted = false;
let intentionalClose = false;

const activeChannels = new Set<string>();
const channelRefCounts = new Map<string, number>();

type StatusListener = (connected: boolean) => void;
const statusListeners = new Set<StatusListener>();

type ChannelHandlers = {
  onNew?: (message: ChatMessage) => void;
  onUpdated?: (message: ChatMessage) => void;
  onDeleted?: (payload: MessageDeletedEvent) => void;
  onResync?: () => void;
};

const channelHandlers = new Map<string, Set<ChannelHandlers>>();

function emitStatus(connected: boolean) {
  for (const listener of statusListeners) {
    listener(connected);
  }
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(Boolean(socket?.connected));
  return () => statusListeners.delete(listener);
}

async function resolveAccessToken(): Promise<string | null> {
  const existing = await webTokenStore.getAccessToken();
  if (existing) return existing;
  const refresh = await webTokenStore.getRefreshToken();
  if (!refresh) return null;
  try {
    await getApiClient().refresh(refresh);
    return (await webTokenStore.getAccessToken()) ?? null;
  } catch {
    return null;
  }
}

async function handleUnauthorized(): Promise<void> {
  if (!refreshAttempted) {
    refreshAttempted = true;
    const refresh = await webTokenStore.getRefreshToken();
    if (refresh) {
      try {
        await getApiClient().refresh(refresh);
        const token = await webTokenStore.getAccessToken();
        if (token && socket) {
          socket.auth = { token };
          socket.connect();
          return;
        }
      } catch {
        // fall through to logout
      }
    }
  }
  await webTokenStore.clear();
  if (typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
  }
}

async function rejoinActiveChannels(s: AppSocket): Promise<void> {
  const ids = [...activeChannels];
  await Promise.all(
    ids.map(
      (channelId) =>
        new Promise<void>((resolve) => {
          s.emit("chat:join", { channelId }, () => resolve());
        }),
    ),
  );
  for (const channelId of ids) {
    const handlers = channelHandlers.get(channelId);
    if (!handlers) continue;
    for (const h of handlers) {
      h.onResync?.();
    }
  }
}

function wireSocket(s: AppSocket) {
  s.on("connect", () => {
    refreshAttempted = false;
    emitStatus(true);
    void rejoinActiveChannels(s);
  });

  s.on("disconnect", () => {
    emitStatus(false);
  });

  s.on("connect_error", (error) => {
    emitStatus(false);
    const message = error?.message?.toLowerCase?.() ?? "";
    if (message.includes("unauthorized")) {
      void handleUnauthorized();
    }
  });

  s.on("message:new", (message) => {
    const handlers = channelHandlers.get(message.channelId);
    if (!handlers) return;
    for (const h of handlers) h.onNew?.(message);
  });

  s.on("message:updated", (message) => {
    const handlers = channelHandlers.get(message.channelId);
    if (!handlers) return;
    for (const h of handlers) h.onUpdated?.(message);
  });

  s.on("message:deleted", (payload) => {
    const handlers = channelHandlers.get(payload.channelId);
    if (!handlers) return;
    for (const h of handlers) h.onDeleted?.(payload);
  });
}

export async function getSocket(): Promise<AppSocket> {
  if (socket?.connected) {
    return socket;
  }
  if (connecting) {
    return connecting;
  }

  intentionalClose = false;
  connecting = (async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw new Error("unauthorized");
    }

    if (!socket) {
      socket = io(baseUrl, {
        autoConnect: false,
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
      });
      wireSocket(socket);
    } else {
      socket.auth = { token };
    }

    if (!socket.connected) {
      await new Promise<void>((resolve, reject) => {
        const onConnect = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          socket?.off("connect", onConnect);
          socket?.off("connect_error", onError);
        };
        socket!.once("connect", onConnect);
        socket!.once("connect_error", onError);
        socket!.connect();
      });
    }

    return socket!;
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

export async function joinChannel(channelId: string, handlers: ChannelHandlers): Promise<void> {
  const set = channelHandlers.get(channelId) ?? new Set();
  set.add(handlers);
  channelHandlers.set(channelId, set);

  const prev = channelRefCounts.get(channelId) ?? 0;
  channelRefCounts.set(channelId, prev + 1);
  activeChannels.add(channelId);

  const s = await getSocket();
  await new Promise<{ ok: boolean }>((resolve) => {
    s.emit("chat:join", { channelId }, (ack) => {
      resolve(ack ?? { ok: false });
    });
  });
}

export async function leaveChannel(channelId: string, handlers: ChannelHandlers): Promise<void> {
  const set = channelHandlers.get(channelId);
  if (set) {
    set.delete(handlers);
    if (set.size === 0) {
      channelHandlers.delete(channelId);
    }
  }

  const prev = channelRefCounts.get(channelId) ?? 0;
  const next = Math.max(0, prev - 1);
  if (next === 0) {
    channelRefCounts.delete(channelId);
    activeChannels.delete(channelId);
    if (socket?.connected) {
      socket.emit("chat:leave", { channelId });
    }
  } else {
    channelRefCounts.set(channelId, next);
  }
}

export function disconnectSocket(): void {
  intentionalClose = true;
  activeChannels.clear();
  channelRefCounts.clear();
  channelHandlers.clear();
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  connecting = null;
  void intentionalClose;
}

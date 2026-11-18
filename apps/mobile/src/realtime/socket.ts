import { io, type Socket } from "socket.io-client";
import type {
  ChatClientToServerEvents,
  ChatMessage,
  ChatServerToClientEvents,
  MessageDeletedEvent,
} from "@app/shared-types";
import { AppState, type AppStateStatus } from "react-native";
import { getApiBaseUrl, getApiClient } from "../lib/api";
import { mobileTokenStore } from "../lib/token-store";

/** ListenEvents = server→client, EmitEvents = client→server */
type AppSocket = Socket<ChatServerToClientEvents, ChatClientToServerEvents>;

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

let socket: AppSocket | null = null;
let connecting: Promise<AppSocket> | null = null;
let connectingGeneration = -1;
let connectionGeneration = 0;
let refreshAttempted = false;
let backgrounded = false;
let unauthorizedNotified = false;
let unauthorizedHandler: (() => void) | null = null;

function emitStatus(connected: boolean) {
  for (const listener of statusListeners) listener(connected);
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(Boolean(socket?.connected) && !backgrounded);
  return () => statusListeners.delete(listener);
}

export function setSocketUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function notifyUnauthorized(): void {
  if (unauthorizedNotified) return;
  unauthorizedNotified = true;
  if (unauthorizedHandler) {
    unauthorizedHandler();
    return;
  }
  void mobileTokenStore.clear();
}

async function resolveAccessToken(): Promise<string | null> {
  const existing = await mobileTokenStore.getAccessToken();
  if (existing) return existing;
  const refresh = await mobileTokenStore.getRefreshToken();
  if (!refresh) return null;
  try {
    await getApiClient().refresh(refresh);
    return (await mobileTokenStore.getAccessToken()) ?? null;
  } catch {
    return null;
  }
}

async function handleUnauthorized(): Promise<void> {
  if (backgrounded) return;
  if (!refreshAttempted) {
    refreshAttempted = true;
    const refresh = await mobileTokenStore.getRefreshToken();
    if (refresh) {
      try {
        await getApiClient().refresh(refresh);
        const token = await mobileTokenStore.getAccessToken();
        if (token && socket && !backgrounded) {
          socket.auth = { token };
          socket.connect();
          return;
        }
      } catch {
        // fall through to sign-out
      }
    }
  }
  notifyUnauthorized();
}

async function rejoinActiveChannels(current: AppSocket): Promise<void> {
  const ids = [...activeChannels];
  await Promise.all(
    ids.map(
      (channelId) =>
        new Promise<void>((resolve) => {
          current.emit("chat:join", { channelId }, () => resolve());
        }),
    ),
  );
  for (const channelId of ids) {
    const handlers = channelHandlers.get(channelId);
    if (!handlers) continue;
    for (const handler of handlers) handler.onResync?.();
  }
}

function wireSocket(current: AppSocket) {
  current.on("connect", () => {
    refreshAttempted = false;
    unauthorizedNotified = false;
    if (backgrounded) {
      current.disconnect();
      emitStatus(false);
      return;
    }
    emitStatus(true);
    void rejoinActiveChannels(current);
  });

  current.on("disconnect", () => {
    emitStatus(false);
  });

  current.on("connect_error", (error) => {
    emitStatus(false);
    if (backgrounded) return;
    const message = error.message.toLowerCase();
    if (message.includes("unauthorized")) {
      void handleUnauthorized();
    }
  });

  current.on("message:new", (message) => {
    const handlers = channelHandlers.get(message.channelId);
    if (!handlers) return;
    for (const handler of handlers) handler.onNew?.(message);
  });

  current.on("message:updated", (message) => {
    const handlers = channelHandlers.get(message.channelId);
    if (!handlers) return;
    for (const handler of handlers) handler.onUpdated?.(message);
  });

  current.on("message:deleted", (payload) => {
    const handlers = channelHandlers.get(payload.channelId);
    if (!handlers) return;
    for (const handler of handlers) handler.onDeleted?.(payload);
  });
}

function waitForConnect(current: AppSocket, generation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onConnect = () => {
      cleanup();
      if (generation !== connectionGeneration || backgrounded) {
        reject(new Error("background"));
        return;
      }
      resolve();
    };
    const cleanup = () => {
      current.off("connect", onConnect);
      current.off("connect_error", fail);
      current.off("disconnect", onDisconnect);
    };
    const onDisconnect = () => fail(new Error("disconnected"));

    if (generation !== connectionGeneration || backgrounded) {
      reject(new Error("background"));
      return;
    }
    current.once("connect", onConnect);
    current.once("connect_error", fail);
    current.once("disconnect", onDisconnect);
    if (current.connected) {
      onConnect();
      return;
    }
    current.connect();
  });
}

async function openSocket(generation: number): Promise<AppSocket> {
  if (generation !== connectionGeneration || backgrounded) {
    throw new Error("background");
  }
  const token = await resolveAccessToken();
  if (generation !== connectionGeneration || backgrounded) {
    throw new Error("background");
  }
  if (!token) {
    notifyUnauthorized();
    throw new Error("unauthorized");
  }

  if (!socket) {
    socket = io(getApiBaseUrl(), {
      autoConnect: false,
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
    });
    wireSocket(socket);
  } else {
    socket.auth = { token };
  }

  if (generation !== connectionGeneration || backgrounded) {
    throw new Error("background");
  }
  if (!socket.connected) {
    await waitForConnect(socket, generation);
  }
  if (generation !== connectionGeneration || backgrounded) {
    throw new Error("background");
  }
  return socket;
}

export async function getSocket(): Promise<AppSocket> {
  if (backgrounded) throw new Error("background");
  if (socket?.connected) return socket;
  if (connecting && connectingGeneration === connectionGeneration) return connecting;

  const generation = connectionGeneration;
  connectingGeneration = generation;
  connecting = openSocket(generation).finally(() => {
    if (connectingGeneration === generation) connecting = null;
  });
  return connecting;
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected) && !backgrounded;
}

export async function joinChannel(channelId: string, handlers: ChannelHandlers): Promise<void> {
  const set = channelHandlers.get(channelId) ?? new Set();
  set.add(handlers);
  channelHandlers.set(channelId, set);

  const prev = channelRefCounts.get(channelId) ?? 0;
  channelRefCounts.set(channelId, prev + 1);
  activeChannels.add(channelId);

  const current = await getSocket();
  await new Promise<void>((resolve) => {
    current.emit("chat:join", { channelId }, () => resolve());
  });
}

export async function leaveChannel(channelId: string, handlers: ChannelHandlers): Promise<void> {
  const set = channelHandlers.get(channelId);
  if (set) {
    set.delete(handlers);
    if (set.size === 0) channelHandlers.delete(channelId);
  }

  const next = Math.max(0, (channelRefCounts.get(channelId) ?? 0) - 1);
  if (next === 0) {
    channelRefCounts.delete(channelId);
    activeChannels.delete(channelId);
    if (socket?.connected) socket.emit("chat:leave", { channelId });
  } else {
    channelRefCounts.set(channelId, next);
  }
}

function pauseForBackground(): void {
  backgrounded = true;
  connectionGeneration += 1;
  const current = socket;
  if (!current) {
    emitStatus(false);
    return;
  }
  const onDisconnect = () => {
    if (!backgrounded && activeChannels.size > 0) {
      void getSocket().catch(() => emitStatus(false));
    }
  };
  current.once("disconnect", onDisconnect);
  if (current.connected) {
    current.disconnect();
  } else {
    current.off("disconnect", onDisconnect);
  }
  emitStatus(false);
}

function resumeFromBackground(): void {
  backgrounded = false;
  if (activeChannels.size === 0) return;
  if (socket?.connected) {
    void rejoinActiveChannels(socket);
    emitStatus(true);
    return;
  }
  void getSocket()
    .catch(() => getSocket())
    .catch(() => emitStatus(false));
}

export function disconnectSocket(): void {
  connectionGeneration += 1;
  backgrounded = false;
  refreshAttempted = false;
  activeChannels.clear();
  channelRefCounts.clear();
  channelHandlers.clear();
  const current = socket;
  socket = null;
  connecting = null;
  current?.removeAllListeners();
  current?.disconnect();
  emitStatus(false);
}

let appState: AppStateStatus = (AppState.currentState ?? "active") as AppStateStatus;

AppState.addEventListener("change", (next) => {
  const previous = appState;
  appState = next;
  if (next === "background") {
    pauseForBackground();
    return;
  }
  if (next === "active" && previous !== "active") {
    resumeFromBackground();
  }
});

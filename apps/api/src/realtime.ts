import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import type {
  ChatClientToServerEvents,
  ChatMessage,
  ChatServerToClientEvents,
  MessageDeletedEvent,
} from "@app/shared-types";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { chatChannels } from "./db/schema";
import { canAccessChannel } from "./lib/chat-access";
import type { JwtPayload } from "./services/auth-service";

type AppSocket = Socket<ChatClientToServerEvents, ChatServerToClientEvents> & {
  data: { user?: JwtPayload; channels?: Set<string> };
};

let io: Server<ChatClientToServerEvents, ChatServerToClientEvents> | null = null;

export function getIo() {
  return io;
}

export function roomName(channelId: string) {
  return `chat:${channelId}`;
}

export function emitToChannel(
  channelId: string,
  event: keyof ChatServerToClientEvents,
  payload: ChatMessage | MessageDeletedEvent,
): void {
  io?.to(roomName(channelId)).emit(event, payload as never);
}

export function emitMessageNew(message: ChatMessage): void {
  emitToChannel(message.channelId, "message:new", message);
}

export function emitMessageUpdated(message: ChatMessage): void {
  emitToChannel(message.channelId, "message:updated", message);
}

export function emitMessageDeleted(payload: MessageDeletedEvent): void {
  emitToChannel(payload.channelId, "message:deleted", payload);
}

/** Drop a user's sockets out of every chat room for a group. */
export async function kickUserFromGroupChats(userId: string, groupId: string): Promise<void> {
  if (!io) return;

  const channels = await db.query.chatChannels.findMany({
    where: eq(chatChannels.groupId, groupId),
    columns: { id: true },
  });
  if (channels.length === 0) return;

  const rooms = channels.map((c) => roomName(c.id));
  for (const socket of io.sockets.sockets.values()) {
    const appSocket = socket as AppSocket;
    if (appSocket.data.user?.sub !== userId) continue;
    for (const room of rooms) {
      await appSocket.leave(room);
    }
    if (appSocket.data.channels) {
      for (const id of channels.map((c) => c.id)) {
        appSocket.data.channels.delete(id);
      }
    }
  }
}

export function attachRealtime(
  app: FastifyInstance,
): Server<ChatClientToServerEvents, ChatServerToClientEvents> {
  if (io) {
    return io;
  }

  io = new Server(app.server, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown })?.token;
    if (typeof token !== "string" || !token) {
      next(new Error("unauthorized"));
      return;
    }
    try {
      const payload = app.jwt.verify<JwtPayload>(token);
      (socket as AppSocket).data.user = payload;
      (socket as AppSocket).data.channels = new Set();
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AppSocket;

    socket.on("chat:join", async (payload, ack) => {
      const respond = (result: { ok: true } | { ok: false; error: string }) => {
        if (typeof ack === "function") {
          ack(result);
        }
      };

      try {
        const user = socket.data.user;
        if (!user) {
          respond({ ok: false, error: "unauthorized" });
          socket.disconnect(true);
          return;
        }

        const channelId = payload?.channelId;
        if (typeof channelId !== "string") {
          respond({ ok: false, error: "invalid_payload" });
          return;
        }

        const allowed = await canAccessChannel(user.sub, channelId);
        if (!allowed) {
          respond({ ok: false, error: "forbidden" });
          return;
        }

        await socket.join(roomName(channelId));
        socket.data.channels ??= new Set();
        socket.data.channels.add(channelId);
        respond({ ok: true });
      } catch {
        respond({ ok: false, error: "join_failed" });
      }
    });

    socket.on("chat:leave", async (payload) => {
      const channels = socket.data.channels;
      if (!channels || channels.size === 0) return;

      if (payload?.channelId) {
        await socket.leave(roomName(payload.channelId));
        channels.delete(payload.channelId);
        return;
      }

      for (const channelId of [...channels]) {
        await socket.leave(roomName(channelId));
        channels.delete(channelId);
      }
    });
  });

  return io;
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => {
    io!.close(() => resolve());
  });
  io = null;
}

/** Used by tests that need a clean slate between files. */
export function resetRealtimeForTests(): void {
  io = null;
}

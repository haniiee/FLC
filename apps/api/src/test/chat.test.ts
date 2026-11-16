import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import type { FastifyInstance } from "fastify";
import type { ChatMessage } from "@app/shared-types";
import { env } from "../env";
import {
  authHeader,
  closeTestApp,
  createTestApp,
  db,
  register,
  resetDb,
  schema,
  teacherAuth,
} from "./helpers";

function hasBinary(bin: string): boolean {
  const result = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

const HAS_FFMPEG = hasBinary(env.FFMPEG_PATH) && hasBinary(env.FFPROBE_PATH);

async function listenApp(app: FastifyInstance) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind test server");
  }
  return `http://127.0.0.1:${address.port}`;
}

function connectSocket(baseUrl: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      forceNew: true,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("socket connect timeout"));
    }, 10_000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function joinChannel(socket: Socket, channelId: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("chat:join", { channelId }, (ack: { ok: boolean; error?: string }) => {
      resolve(ack);
    });
  });
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    function onEvent(payload: T) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, onEvent);
  });
}

describe("chat", () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    app = await createTestApp();
    baseUrl = await listenApp(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDb();
  });

  async function setupGroupWithStudent() {
    const teacher = await teacherAuth(app, "09125000001");
    const groupRes = await app.inject({
      method: "POST",
      url: "/groups",
      headers: authHeader(teacher.accessToken),
      payload: { name: "کلاس تست" },
    });
    expect(groupRes.statusCode).toBe(200);
    const group = groupRes.json();

    const inviteRes = await app.inject({
      method: "POST",
      url: `/groups/${group.id}/invites`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    const invite = inviteRes.json();

    const studentReg = await register(app, {
      phone: "09125000002",
      password: "password1",
      displayName: "Student",
    });
    const studentLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { phone: "09125000002", password: "password1" },
    });
    const student = {
      user: studentLogin.json().user,
      accessToken: studentLogin.json().accessToken as string,
    };
    expect(studentReg.status).toBe(200);

    const join = await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.accessToken),
    });
    expect(join.statusCode).toBe(200);

    const chats = await app.inject({
      method: "GET",
      url: `/groups/${group.id}/chats`,
      headers: authHeader(student.accessToken),
    });
    expect(chats.statusCode).toBe(200);
    const channels = chats.json().channels as Array<{ id: string; kind: string }>;
    expect(channels).toHaveLength(2);
    const allChannel = channels.find((c) => c.kind === "all")!;
    const studentsChannel = channels.find((c) => c.kind === "students")!;
    expect(allChannel).toBeTruthy();
    expect(studentsChannel).toBeTruthy();

    return { teacher, student, group, allChannel, studentsChannel };
  }

  it("student can access all+students; teacher gets 403 on students (REST + join)", async () => {
    const { teacher, student, group, allChannel, studentsChannel } = await setupGroupWithStudent();

    const studentStudents = await app.inject({
      method: "GET",
      url: `/chats/${studentsChannel.id}/messages`,
      headers: authHeader(student.accessToken),
    });
    expect(studentStudents.statusCode).toBe(200);

    const studentAll = await app.inject({
      method: "GET",
      url: `/chats/${allChannel.id}/messages`,
      headers: authHeader(student.accessToken),
    });
    expect(studentAll.statusCode).toBe(200);

    const teacherStudents = await app.inject({
      method: "GET",
      url: `/chats/${studentsChannel.id}/messages`,
      headers: authHeader(teacher.accessToken),
    });
    expect(teacherStudents.statusCode).toBe(403);

    const teacherList = await app.inject({
      method: "GET",
      url: `/groups/${group.id}/chats`,
      headers: authHeader(teacher.accessToken),
    });
    expect(teacherList.statusCode).toBe(200);
    expect(teacherList.json().channels).toHaveLength(1);
    expect(teacherList.json().channels[0].kind).toBe("all");

    const teacherSocket = await connectSocket(baseUrl, teacher.accessToken);
    const studentSocket = await connectSocket(baseUrl, student.accessToken);
    try {
      const teacherJoinStudents = await joinChannel(teacherSocket, studentsChannel.id);
      expect(teacherJoinStudents.ok).toBe(false);

      const studentJoinStudents = await joinChannel(studentSocket, studentsChannel.id);
      expect(studentJoinStudents.ok).toBe(true);

      const teacherJoinAll = await joinChannel(teacherSocket, allChannel.id);
      expect(teacherJoinAll.ok).toBe(true);
    } finally {
      teacherSocket.close();
      studentSocket.close();
    }
  });

  it("non-member gets 403 on both channels", async () => {
    const { allChannel, studentsChannel } = await setupGroupWithStudent();
    const outsiderReg = await register(app, {
      phone: "09125000099",
      password: "password1",
      displayName: "Outsider",
    });
    expect(outsiderReg.status).toBe(200);
    const outsiderLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { phone: "09125000099", password: "password1" },
    });
    const token = outsiderLogin.json().accessToken as string;

    for (const channelId of [allChannel.id, studentsChannel.id]) {
      const res = await app.inject({
        method: "GET",
        url: `/chats/${channelId}/messages`,
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(403);
    }

    const socket = await connectSocket(baseUrl, token);
    try {
      const joinAll = await joinChannel(socket, allChannel.id);
      expect(joinAll.ok).toBe(false);
      const joinStudents = await joinChannel(socket, studentsChannel.id);
      expect(joinStudents.ok).toBe(false);
    } finally {
      socket.close();
    }
  });

  it("emits message:new to other client in the same channel", async () => {
    const { teacher, student, allChannel } = await setupGroupWithStudent();
    const socketA = await connectSocket(baseUrl, teacher.accessToken);
    const socketB = await connectSocket(baseUrl, student.accessToken);
    try {
      expect((await joinChannel(socketA, allChannel.id)).ok).toBe(true);
      expect((await joinChannel(socketB, allChannel.id)).ok).toBe(true);

      const pending = waitForEvent<ChatMessage>(socketB, "message:new");
      const send = await app.inject({
        method: "POST",
        url: `/chats/${allChannel.id}/messages`,
        headers: authHeader(teacher.accessToken),
        payload: { text: "سلام از معلم" },
      });
      expect(send.statusCode).toBe(200);
      const received = await pending;
      expect(received.text).toBe("سلام از معلم");
      expect(received.sender.id).toBe(teacher.user.id);
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  it("paginates 120 messages with before without gaps or duplicates", async () => {
    const { teacher, allChannel } = await setupGroupWithStudent();
    const base = Date.now();
    await db.insert(schema.chatMessages).values(
      Array.from({ length: 120 }, (_, i) => ({
        channelId: allChannel.id,
        senderId: teacher.user.id as string,
        type: "text" as const,
        text: `msg-${i}`,
        status: "ready" as const,
        createdAt: new Date(base + i),
      })),
    );

    const page1 = await app.inject({
      method: "GET",
      url: `/chats/${allChannel.id}/messages?limit=50`,
      headers: authHeader(teacher.accessToken),
    });
    expect(page1.statusCode).toBe(200);
    const m1 = page1.json().messages as ChatMessage[];
    expect(m1).toHaveLength(50);

    const page2 = await app.inject({
      method: "GET",
      url: `/chats/${allChannel.id}/messages?limit=50&before=${m1[m1.length - 1]!.id}`,
      headers: authHeader(teacher.accessToken),
    });
    const m2 = page2.json().messages as ChatMessage[];
    expect(m2).toHaveLength(50);

    const page3 = await app.inject({
      method: "GET",
      url: `/chats/${allChannel.id}/messages?limit=50&before=${m2[m2.length - 1]!.id}`,
      headers: authHeader(teacher.accessToken),
    });
    const m3 = page3.json().messages as ChatMessage[];
    expect(m3).toHaveLength(20);

    const ids = [...m1, ...m2, ...m3].map((m) => m.id);
    expect(new Set(ids).size).toBe(120);
    expect(ids).toHaveLength(120);
  });

  it("delete: student cannot delete others; teacher can in all and emits deleted", async () => {
    const { teacher, student, allChannel } = await setupGroupWithStudent();
    const created = await app.inject({
      method: "POST",
      url: `/chats/${allChannel.id}/messages`,
      headers: authHeader(teacher.accessToken),
      payload: { text: "حذف‌شدنی" },
    });
    const message = created.json() as ChatMessage;

    const studentDelete = await app.inject({
      method: "DELETE",
      url: `/chat-messages/${message.id}`,
      headers: authHeader(student.accessToken),
    });
    expect(studentDelete.statusCode).toBe(403);

    const socket = await connectSocket(baseUrl, student.accessToken);
    try {
      expect((await joinChannel(socket, allChannel.id)).ok).toBe(true);
      const pending = waitForEvent<{ id: string; channelId: string }>(socket, "message:deleted");
      const teacherDelete = await app.inject({
        method: "DELETE",
        url: `/chat-messages/${message.id}`,
        headers: authHeader(teacher.accessToken),
      });
      expect(teacherDelete.statusCode).toBe(200);
      const deleted = await pending;
      expect(deleted.id).toBe(message.id);
      expect(deleted.channelId).toBe(allChannel.id);
    } finally {
      socket.close();
    }

    const list = await app.inject({
      method: "GET",
      url: `/chats/${allChannel.id}/messages`,
      headers: authHeader(student.accessToken),
    });
    const found = (list.json().messages as ChatMessage[]).find((m) => m.id === message.id);
    expect(found?.deleted).toBe(true);
    expect(found?.text).toBeNull();
  });

  it.skipIf(!HAS_FFMPEG)(
    "voice webm without duration becomes ready audio/mp4 via socket events",
    async () => {
      const { student, allChannel } = await setupGroupWithStudent();
      const dir = await mkdtemp(join(tmpdir(), "flc-chat-voice-"));
      const webmPath = join(dir, "noseek.webm");
      try {
        const generated = spawnSync(
          env.FFMPEG_PATH,
          [
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2",
            "-c:a",
            "libopus",
            "-f",
            "webm",
            "pipe:1",
          ],
          { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 },
        );
        if (generated.status !== 0 || !generated.stdout?.length) {
          throw new Error(generated.stderr?.toString("utf8") || "pipe webm failed");
        }
        await writeFile(webmPath, generated.stdout);
        const bytes = await readFile(webmPath);

        const socket = await connectSocket(baseUrl, student.accessToken);
        expect((await joinChannel(socket, allChannel.id)).ok).toBe(true);

        const readyPromise = new Promise<ChatMessage>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("voice ready timeout")), 60_000);
          const onUpdated = (msg: ChatMessage) => {
            if (msg.type === "voice" && msg.status === "ready") {
              clearTimeout(timer);
              socket.off("message:updated", onUpdated);
              socket.off("message:new", onNew);
              resolve(msg);
            }
          };
          const onNew = (msg: ChatMessage) => {
            if (msg.type === "voice" && msg.status === "ready") {
              clearTimeout(timer);
              socket.off("message:updated", onUpdated);
              socket.off("message:new", onNew);
              resolve(msg);
            }
          };
          socket.on("message:updated", onUpdated);
          socket.on("message:new", onNew);
        });

        const upload = await app.inject({
          method: "POST",
          url: `/chats/${allChannel.id}/voice/upload-url`,
          headers: authHeader(student.accessToken),
          payload: {
            mimeType: "audio/webm;codecs=opus",
            sizeBytes: bytes.length,
          },
        });
        expect(upload.statusCode).toBe(200);
        const body = upload.json();
        await fetch(body.uploadUrl, {
          method: "PUT",
          headers: { "content-type": "audio/webm" },
          body: bytes,
        });
        const complete = await app.inject({
          method: "POST",
          url: `/chat-messages/${body.message.id}/complete`,
          headers: authHeader(student.accessToken),
        });
        expect(complete.statusCode).toBe(202);

        const ready = await readyPromise;
        expect(ready.status).toBe("ready");
        expect(ready.mimeType).toBe("audio/mp4");
        expect(ready.durationMs).toBeGreaterThanOrEqual(1900);
        expect(ready.durationMs).toBeLessThanOrEqual(2100);
        socket.close();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it("rate limits the 21st message within 10 seconds with 429", async () => {
    const { teacher, allChannel } = await setupGroupWithStudent();
    let lastStatus = 200;
    for (let i = 0; i < 21; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: `/chats/${allChannel.id}/messages`,
        headers: authHeader(teacher.accessToken),
        payload: { text: `rl-${i}` },
      });
      lastStatus = res.statusCode;
      if (i < 20) {
        expect(res.statusCode).toBe(200);
      }
    }
    expect(lastStatus).toBe(429);
  });
});

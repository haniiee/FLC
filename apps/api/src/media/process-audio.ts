import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import type { ChatMessage, GroupRole } from "@app/shared-types";
import { db } from "../db";
import { chatChannels, chatMessages, files, groupMembers, users } from "../db/schema";
import { env } from "../env";
import { toChatMessageDto } from "../lib/chat-mappers";
import { emitMessageNew, emitMessageUpdated } from "../realtime";
import { deleteStorageKeys, downloadObjectStream, headObject, putObjectFromFile } from "../storage";
import { needsTranscode } from "./codecs";
import { ensureDurationMs, probe } from "./ffprobe";
import { enqueueProcessAudio, type AudioJobTarget } from "./queue";
import { toAacM4a } from "./transcode";

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 280);
}

function replaceExtension(storageKey: string, ext: string): string {
  const cleaned = ext.replace(/^\./, "");
  const dir = storageKey.includes("/") ? storageKey.slice(0, storageKey.lastIndexOf("/") + 1) : "";
  const base = basename(storageKey);
  const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  return `${dir}${stem}.${cleaned}`;
}

type LoadedAudio = {
  storageKey: string;
  channelId?: string;
  senderId?: string;
};

async function loadAudio(target: AudioJobTarget): Promise<LoadedAudio | null> {
  if (target.table === "files") {
    const file = await db.query.files.findFirst({ where: eq(files.id, target.id) });
    if (!file || file.kind !== "audio" || !file.storageKey) {
      return null;
    }
    return { storageKey: file.storageKey };
  }

  const message = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, target.id),
  });
  if (!message || message.type !== "voice" || !message.storageKey || message.deletedAt) {
    return null;
  }
  return {
    storageKey: message.storageKey,
    channelId: message.channelId,
    senderId: message.senderId,
  };
}

async function setProcessing(target: AudioJobTarget): Promise<void> {
  if (target.table === "files") {
    await db
      .update(files)
      .set({
        status: "processing",
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(files.id, target.id));
    return;
  }

  const [updated] = await db
    .update(chatMessages)
    .set({
      status: "processing",
      processingError: null,
    })
    .where(eq(chatMessages.id, target.id))
    .returning();

  if (updated) {
    await emitChatMessage(updated, "message:updated");
  }
}

async function markFailed(target: AudioJobTarget, error: unknown): Promise<void> {
  console.error(`[media] processAudio failed ${target.table}=${target.id}`, error);
  const processingError = shortError(error);

  if (target.table === "files") {
    await db
      .update(files)
      .set({
        status: "failed",
        processingError,
        updatedAt: new Date(),
      })
      .where(eq(files.id, target.id));
    return;
  }

  const [updated] = await db
    .update(chatMessages)
    .set({
      status: "failed",
      processingError,
    })
    .where(eq(chatMessages.id, target.id))
    .returning();

  if (updated) {
    await emitChatMessage(updated, "message:updated");
  }
}

async function markPassthroughReady(
  target: AudioJobTarget,
  durationMs: number | null,
): Promise<void> {
  if (target.table === "files") {
    await db
      .update(files)
      .set({
        status: "ready",
        durationMs,
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(files.id, target.id));
    return;
  }

  const [updated] = await db
    .update(chatMessages)
    .set({
      status: "ready",
      durationMs,
      processingError: null,
    })
    .where(eq(chatMessages.id, target.id))
    .returning();

  if (updated) {
    await emitChatMessage(updated, "message:new");
    await emitChatMessage(updated, "message:updated");
  }
}

async function markTranscodedReady(
  target: AudioJobTarget,
  patch: {
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number | null;
    previousKey: string;
  },
): Promise<void> {
  if (target.table === "files") {
    await db
      .update(files)
      .set({
        status: "ready",
        storageKey: patch.storageKey,
        mimeType: patch.mimeType,
        sizeBytes: patch.sizeBytes,
        durationMs: patch.durationMs,
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(files.id, target.id));
  } else {
    const [updated] = await db
      .update(chatMessages)
      .set({
        status: "ready",
        storageKey: patch.storageKey,
        mimeType: patch.mimeType,
        sizeBytes: patch.sizeBytes,
        durationMs: patch.durationMs,
        processingError: null,
      })
      .where(eq(chatMessages.id, target.id))
      .returning();

    if (updated) {
      await emitChatMessage(updated, "message:new");
      await emitChatMessage(updated, "message:updated");
    }
  }

  if (patch.storageKey !== patch.previousKey) {
    await deleteStorageKeys([patch.previousKey]);
  }
}

async function emitChatMessage(
  message: typeof chatMessages.$inferSelect,
  event: "message:new" | "message:updated",
): Promise<void> {
  const channel = await db.query.chatChannels.findFirst({
    where: eq(chatChannels.id, message.channelId),
  });
  if (!channel) return;

  const sender = await db.query.users.findFirst({
    where: eq(users.id, message.senderId),
  });
  if (!sender) return;

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, channel.groupId),
      eq(groupMembers.userId, message.senderId),
    ),
  });

  const dto: ChatMessage = toChatMessageDto(message, {
    id: sender.id,
    displayName: sender.displayName,
    role: (membership?.role ?? "student") as GroupRole,
  });

  if (event === "message:new") {
    emitMessageNew(dto);
  } else {
    emitMessageUpdated(dto);
  }
}

export async function processAudio(target: AudioJobTarget | string): Promise<void> {
  const normalized: AudioJobTarget =
    typeof target === "string" ? { table: "files", id: target } : target;

  const loaded = await loadAudio(normalized);
  if (!loaded) {
    return;
  }

  await setProcessing(normalized);

  const workDir = await mkdtemp(join(tmpdir(), "flc-audio-"));
  const originalExt = extname(loaded.storageKey) || ".bin";
  const inputPath = join(workDir, `input${originalExt}`);
  const outputPath = join(workDir, "output.m4a");

  try {
    const body = await downloadObjectStream(loaded.storageKey);
    if (!body) {
      throw new Error("empty S3 object body");
    }
    await pipeline(body as Readable, createWriteStream(inputPath));

    let probed;
    try {
      probed = await probe(inputPath);
    } catch (error) {
      await markFailed(normalized, error instanceof Error ? error : new Error("ffprobe failed"));
      return;
    }

    if (!needsTranscode(probed.codec)) {
      const durationMs = await ensureDurationMs(inputPath, probed.durationMs);
      await markPassthroughReady(normalized, durationMs);
      return;
    }

    await toAacM4a(inputPath, outputPath);

    let durationMs: number | null = null;
    try {
      const outProbe = await probe(outputPath);
      durationMs = await ensureDurationMs(outputPath, outProbe.durationMs);
    } catch {
      durationMs = await ensureDurationMs(outputPath, null);
    }

    const outStat = await stat(outputPath);
    const newKey = replaceExtension(loaded.storageKey, "m4a");

    await putObjectFromFile(newKey, outputPath, "audio/mp4");

    const head = await headObject(newKey);
    const sizeBytes = head.ContentLength ?? outStat.size;

    await markTranscodedReady(normalized, {
      storageKey: newKey,
      mimeType: "audio/mp4",
      sizeBytes,
      durationMs,
      previousKey: loaded.storageKey,
    });
  } catch (error) {
    await markFailed(normalized, error);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function scheduleProcessAudio(target: AudioJobTarget | string): void {
  enqueueProcessAudio(target, processAudio);
}

export async function recoverProcessingAudio(): Promise<void> {
  const audioFiles = await db.query.files.findMany({
    where: and(eq(files.status, "processing"), eq(files.kind, "audio")),
  });
  const audioMessages = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.status, "processing"), eq(chatMessages.type, "voice")),
  });

  const total = audioFiles.length + audioMessages.length;
  if (total === 0) {
    return;
  }
  console.warn(`[media] recovering ${total} processing audio item(s)`);
  for (const row of audioFiles) {
    scheduleProcessAudio({ table: "files", id: row.id });
  }
  for (const row of audioMessages) {
    scheduleProcessAudio({ table: "chat_messages", id: row.id });
  }
}

export async function checkFfmpeg(): Promise<"ok" | "missing"> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn(env.FFMPEG_PATH, ["-version"], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve("missing");
    }, 5_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve("missing");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? "ok" : "missing");
    });
  });
}

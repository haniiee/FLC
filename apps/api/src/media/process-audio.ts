import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { files } from "../db/schema";
import { env } from "../env";
import { deleteStorageKeys, downloadObjectStream, headObject, putObjectFromFile } from "../storage";
import { needsTranscode } from "./codecs";
import { probe } from "./ffprobe";
import { enqueueProcessAudio } from "./queue";
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

async function markFailed(fileId: string, error: unknown): Promise<void> {
  console.error(`[media] processAudio failed fileId=${fileId}`, error);
  await db
    .update(files)
    .set({
      status: "failed",
      processingError: shortError(error),
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));
}

export async function processAudio(fileId: string): Promise<void> {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file || file.kind !== "audio" || !file.storageKey) {
    return;
  }

  await db
    .update(files)
    .set({
      status: "processing",
      processingError: null,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  const workDir = await mkdtemp(join(tmpdir(), "flc-audio-"));
  const originalExt = extname(file.storageKey) || ".bin";
  const inputPath = join(workDir, `input${originalExt}`);
  const outputPath = join(workDir, "output.m4a");

  try {
    const body = await downloadObjectStream(file.storageKey);
    if (!body) {
      throw new Error("empty S3 object body");
    }
    await pipeline(body as Readable, createWriteStream(inputPath));

    let probed;
    try {
      probed = await probe(inputPath);
    } catch (error) {
      await markFailed(fileId, error instanceof Error ? error : new Error("ffprobe failed"));
      return;
    }

    if (!needsTranscode(probed.codec)) {
      await db
        .update(files)
        .set({
          status: "ready",
          durationMs: probed.durationMs,
          processingError: null,
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));
      return;
    }

    await toAacM4a(inputPath, outputPath);
    const outStat = await stat(outputPath);
    const newKey = replaceExtension(file.storageKey, "m4a");

    await putObjectFromFile(newKey, outputPath, "audio/mp4");

    const head = await headObject(newKey);
    const sizeBytes = head.ContentLength ?? outStat.size;

    await db
      .update(files)
      .set({
        status: "ready",
        storageKey: newKey,
        mimeType: "audio/mp4",
        sizeBytes,
        durationMs: probed.durationMs,
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    if (newKey !== file.storageKey) {
      await deleteStorageKeys([file.storageKey]);
    }
  } catch (error) {
    await markFailed(fileId, error);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function scheduleProcessAudio(fileId: string): void {
  enqueueProcessAudio(fileId, processAudio);
}

export async function recoverProcessingAudio(): Promise<void> {
  const audio = await db.query.files.findMany({
    where: and(eq(files.status, "processing"), eq(files.kind, "audio")),
  });
  if (audio.length === 0) {
    return;
  }
  console.warn(`[media] recovering ${audio.length} processing audio file(s)`);
  for (const row of audio) {
    scheduleProcessAudio(row.id);
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

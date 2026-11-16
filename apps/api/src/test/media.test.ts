import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { env } from "../env";
import { headObject } from "../storage";
import {
  authHeader,
  closeTestApp,
  createTestApp,
  db,
  resetDb,
  schema,
  teacherAuth,
} from "./helpers";

function hasBinary(bin: string): boolean {
  const result = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

const HAS_FFMPEG = hasBinary(env.FFMPEG_PATH) && hasBinary(env.FFPROBE_PATH);

async function createGroup(app: FastifyInstance, token: string) {
  const response = await app.inject({
    method: "POST",
    url: "/groups",
    headers: authHeader(token),
    payload: { name: "کلاس media" },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function createSession(app: FastifyInstance, token: string, groupId: string) {
  const response = await app.inject({
    method: "POST",
    url: `/groups/${groupId}/sessions`,
    headers: authHeader(token),
    payload: {},
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function generateSine(args: string[], outPath: string): Promise<void> {
  const result = spawnSync(env.FFMPEG_PATH, ["-y", ...args, outPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg failed for ${outPath}`);
  }
}

async function pollFileStatus(fileId: string, wanted: "ready" | "failed", timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
    if (row?.status === wanted) {
      return row;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const latest = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
  throw new Error(
    `timeout waiting for ${wanted}; last=${latest?.status} err=${latest?.processingError}`,
  );
}

describe("audio media processing", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDb();
  });

  it.skipIf(!HAS_FFMPEG)("transcodes webm/opus to m4a and sets duration", async () => {
    const teacher = await teacherAuth(app, "09124000001");
    const group = await createGroup(app, teacher.accessToken);
    const session = await createSession(app, teacher.accessToken, group.id);

    const dir = await mkdtemp(join(tmpdir(), "flc-media-webm-"));
    const webmPath = join(dir, "tone.webm");
    try {
      await generateSine(
        ["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "libopus"],
        webmPath,
      );
      const bytes = await readFile(webmPath);

      const upload = await app.inject({
        method: "POST",
        url: "/files/upload-url",
        headers: authHeader(teacher.accessToken),
        payload: {
          sessionId: session.id,
          mimeType: "audio/webm;codecs=opus",
          sizeBytes: bytes.length,
          fileName: "tone.webm",
          source: "recording",
        },
      });
      expect(upload.statusCode).toBe(200);
      const body = upload.json();
      expect(body.file.source).toBe("recording");
      expect(body.file.mimeType).toBe("audio/webm");

      const put = await fetch(body.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "audio/webm" },
        body: bytes,
      });
      expect(put.ok).toBe(true);

      const complete = await app.inject({
        method: "POST",
        url: `/files/${body.file.id}/complete`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      });
      expect(complete.statusCode).toBe(202);
      expect(complete.json().status).toBe("processing");

      const ready = await pollFileStatus(body.file.id, "ready");
      expect(ready.mimeType).toBe("audio/mp4");
      expect(ready.durationMs).toBeGreaterThanOrEqual(1900);
      expect(ready.durationMs).toBeLessThanOrEqual(2100);
      expect(ready.storageKey?.endsWith(".m4a")).toBe(true);

      await headObject(ready.storageKey!);
      const oldKey = `groups/${group.id}/files/${body.file.id}/original.webm`;
      await expect(headObject(oldKey)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!HAS_FFMPEG)("keeps mp3 without transcode but sets durationMs", async () => {
    const teacher = await teacherAuth(app, "09124000002");
    const group = await createGroup(app, teacher.accessToken);
    const session = await createSession(app, teacher.accessToken, group.id);

    const dir = await mkdtemp(join(tmpdir(), "flc-media-mp3-"));
    const mp3Path = join(dir, "tone.mp3");
    try {
      await generateSine(
        ["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "libmp3lame"],
        mp3Path,
      );
      const bytes = await readFile(mp3Path);
      const upload = await app.inject({
        method: "POST",
        url: "/files/upload-url",
        headers: authHeader(teacher.accessToken),
        payload: {
          sessionId: session.id,
          mimeType: "audio/mpeg",
          sizeBytes: bytes.length,
          fileName: "tone.mp3",
        },
      });
      const body = upload.json();
      await fetch(body.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "audio/mpeg" },
        body: bytes,
      });
      const complete = await app.inject({
        method: "POST",
        url: `/files/${body.file.id}/complete`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      });
      expect(complete.statusCode).toBe(202);

      const ready = await pollFileStatus(body.file.id, "ready");
      expect(ready.mimeType).toBe("audio/mpeg");
      expect(ready.storageKey?.endsWith(".mp3")).toBe(true);
      expect(ready.durationMs).toBeGreaterThanOrEqual(1900);
      expect(ready.durationMs).toBeLessThanOrEqual(2100);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("marks corrupt audio as failed with processingError", async () => {
    const teacher = await teacherAuth(app, "09124000003");
    const group = await createGroup(app, teacher.accessToken);
    const session = await createSession(app, teacher.accessToken, group.id);

    const bytes = Buffer.from("not-a-real-webm-" + Math.random().toString(36));
    const upload = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "audio/webm",
        sizeBytes: bytes.length,
        fileName: "bad.webm",
      },
    });
    const body = upload.json();
    await fetch(body.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "audio/webm" },
      body: bytes,
    });
    const complete = await app.inject({
      method: "POST",
      url: `/files/${body.file.id}/complete`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(complete.statusCode).toBe(202);

    const failed = await pollFileStatus(body.file.id, "failed");
    expect(failed.processingError).toBeTruthy();
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
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
import { env } from "../env";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3 } from "../storage";

async function createGroup(app: FastifyInstance, token: string, name = "کلاس محتوا") {
  const response = await app.inject({
    method: "POST",
    url: "/groups",
    headers: authHeader(token),
    payload: { name },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

describe("sessions topics files", () => {
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

  it("auto-numbers sessions sequentially and topics concurrently", async () => {
    const teacher = await teacherAuth(app, "09123000001");
    const group = await createGroup(app, teacher.accessToken);

    const sessions = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      sessions.push(res.json());
    }
    expect(sessions.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(sessions.map((s) => s.displayName)).toEqual(["Session 1", "Session 2", "Session 3"]);

    const sessionId = sessions[0].id as string;
    const topicResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({
          method: "POST",
          url: `/sessions/${sessionId}/topics`,
          headers: authHeader(teacher.accessToken),
          payload: {},
        }),
      ),
    );
    expect(topicResults.every((r) => r.statusCode === 200)).toBe(true);
    const numbers = topicResults.map((r) => r.json().number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("supports displayName rename and null reset", async () => {
    const teacher = await teacherAuth(app, "09123000002");
    const group = await createGroup(app, teacher.accessToken);
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const renamed = await app.inject({
      method: "PATCH",
      url: `/sessions/${session.id}`,
      headers: authHeader(teacher.accessToken),
      payload: { title: "جلسه اول" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().displayName).toBe("جلسه اول");

    const reset = await app.inject({
      method: "PATCH",
      url: `/sessions/${session.id}`,
      headers: authHeader(teacher.accessToken),
      payload: { title: null },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().displayName).toBe("Session 1");
  });

  it("uploads a file end-to-end via MinIO", async () => {
    const teacher = await teacherAuth(app, "09123000003");
    const group = await createGroup(app, teacher.accessToken);
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    // Non-audio stays ready immediately (audio goes through processing queue).
    const bytes = Buffer.from("%PDF-1.4 fake-pdf-content-for-test-0001");
    const upload = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        fileName: "sample.pdf",
      },
    });
    expect(upload.statusCode).toBe(200);
    const uploadBody = upload.json();
    expect(uploadBody.file.status).toBe("pending");
    expect(uploadBody.file.number).toBeNull();
    expect(uploadBody.file.displayName).toBeNull();
    expect(uploadBody.file.source).toBe("upload");

    const put = await fetch(uploadBody.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body: bytes,
    });
    expect(put.ok).toBe(true);

    const complete = await app.inject({
      method: "POST",
      url: `/files/${uploadBody.file.id}/complete`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().status).toBe("ready");
    expect(complete.json().number).toBe(1);
    expect(complete.json().displayName).toBe("PDF 1");

    const urlRes = await app.inject({
      method: "GET",
      url: `/files/${uploadBody.file.id}/url?download=1`,
      headers: authHeader(teacher.accessToken),
    });
    expect(urlRes.statusCode).toBe(200);
    const downloaded = Buffer.from(await (await fetch(urlRes.json().url)).arrayBuffer());
    expect(downloaded.equals(bytes)).toBe(true);

    // Audio complete returns 202 + processing
    const audioBytes = Buffer.from("ID3fake-mp3-content-for-test-0001");
    const audioUpload = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "audio/mpeg",
        sizeBytes: audioBytes.length,
        fileName: "sample.mp3",
      },
    });
    expect(audioUpload.statusCode).toBe(200);
    expect(audioUpload.json().file.number).toBeNull();
    expect(audioUpload.json().file.displayName).toBeNull();
    await fetch(audioUpload.json().uploadUrl, {
      method: "PUT",
      headers: { "content-type": "audio/mpeg" },
      body: audioBytes,
    });
    const audioComplete = await app.inject({
      method: "POST",
      url: `/files/${audioUpload.json().file.id}/complete`,
      headers: authHeader(teacher.accessToken),
      payload: { durationMs: 1200 },
    });
    expect(audioComplete.statusCode).toBe(202);
    expect(audioComplete.json().status).toBe("processing");
    expect(audioComplete.json().number).toBe(1);
    expect(audioComplete.json().displayName).toBe("Voice 1");
  });

  it("rejects invalid mime, oversized files, and incomplete uploads", async () => {
    const teacher = await teacherAuth(app, "09123000004");
    const group = await createGroup(app, teacher.accessToken);
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const badMime = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "application/zip",
        sizeBytes: 10,
        fileName: "x.zip",
      },
    });
    expect(badMime.statusCode).toBe(400);
    expect(badMime.json().error.code).toBe("INVALID_MIME");

    const tooBig = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "audio/mpeg",
        sizeBytes: 51 * 1024 * 1024,
        fileName: "big.mp3",
      },
    });
    expect(tooBig.statusCode).toBe(413);

    const pending = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "audio/mpeg",
        sizeBytes: 12,
        fileName: "missing.mp3",
      },
    });
    expect(pending.statusCode).toBe(200);
    const complete = await app.inject({
      method: "POST",
      url: `/files/${pending.json().file.id}/complete`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(complete.statusCode).toBe(400);
    expect(complete.json().error.code).toBe("FILE_NOT_UPLOADED");

    const failed = await db.query.files.findFirst({
      where: eq(schema.files.id, pending.json().file.id),
    });
    expect(failed?.status).toBe("failed");
  });

  it("enforces student permissions and playlist ordering", async () => {
    const teacher = await teacherAuth(app, "09123000005");
    const group = await createGroup(app, teacher.accessToken);
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const topic = (
      await app.inject({
        method: "POST",
        url: `/sessions/${session.id}/topics`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    async function uploadAudio(topicId: string | undefined, label: string, size: number) {
      const bytes = Buffer.alloc(size, label);
      const upload = (
        await app.inject({
          method: "POST",
          url: "/files/upload-url",
          headers: authHeader(teacher.accessToken),
          payload: {
            sessionId: session.id,
            topicId,
            mimeType: "audio/mpeg",
            sizeBytes: bytes.length,
            fileName: `${label}.mp3`,
          },
        })
      ).json();
      await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "audio/mpeg" },
        body: bytes,
      });
      const complete = await app.inject({
        method: "POST",
        url: `/files/${upload.file.id}/complete`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      });
      expect(complete.statusCode).toBe(202);
      // Wait for async media job to finish, then force ready for ordering tests.
      const start = Date.now();
      while (Date.now() - start < 15_000) {
        const row = await db.query.files.findFirst({
          where: eq(schema.files.id, upload.file.id),
        });
        if (row && row.status !== "processing" && row.status !== "pending") {
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      await db
        .update(schema.files)
        .set({ status: "ready", durationMs: 1000, processingError: null, updatedAt: new Date() })
        .where(eq(schema.files.id, upload.file.id));
      return upload.file.id as string;
    }

    const direct1 = await uploadAudio(undefined, "d1", 20);
    const topic1 = await uploadAudio(topic.id, "t1", 21);
    const direct2 = await uploadAudio(undefined, "d2", 22);

    // pending file should not appear for student
    await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        mimeType: "audio/mpeg",
        sizeBytes: 8,
        fileName: "pending.mp3",
      },
    });

    await app.inject({
      method: "POST",
      url: "/files/text",
      headers: authHeader(teacher.accessToken),
      payload: { sessionId: session.id, content: "hello" },
    });

    const invite = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/invites`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const student = await register(app, {
      phone: "09123000006",
      password: "password1",
      displayName: "Student",
    });
    await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });

    const studentCreate = await app.inject({
      method: "POST",
      url: `/groups/${group.id}/sessions`,
      headers: authHeader(student.body.accessToken),
      payload: {},
    });
    expect(studentCreate.statusCode).toBe(403);

    const detail = await app.inject({
      method: "GET",
      url: `/sessions/${session.id}`,
      headers: authHeader(student.body.accessToken),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().files.every((f: { status: string }) => f.status === "ready")).toBe(true);
    expect(detail.json().files.some((f: { status: string }) => f.status === "pending")).toBe(false);

    const playlist = await app.inject({
      method: "GET",
      url: `/sessions/${session.id}/playlist`,
      headers: authHeader(student.body.accessToken),
    });
    expect(playlist.statusCode).toBe(200);
    const ids = playlist.json().items.map((item: { fileId: string }) => item.fileId);
    expect(ids).toEqual([direct1, direct2, topic1]);

    const outsider = await register(app, {
      phone: "09123000007",
      password: "password1",
      displayName: "Out",
    });
    const outsiderGet = await app.inject({
      method: "GET",
      url: `/sessions/${session.id}`,
      headers: authHeader(outsider.body.accessToken),
    });
    expect([403, 404]).toContain(outsiderGet.statusCode);
  });

  it("deletes session cascade and removes S3 objects", async () => {
    const teacher = await teacherAuth(app, "09123000008");
    const group = await createGroup(app, teacher.accessToken);
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const bytes = Buffer.from("delete-me-audio");
    const upload = (
      await app.inject({
        method: "POST",
        url: "/files/upload-url",
        headers: authHeader(teacher.accessToken),
        payload: {
          sessionId: session.id,
          mimeType: "audio/mpeg",
          sizeBytes: bytes.length,
          fileName: "del.mp3",
        },
      })
    ).json();

    await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "audio/mpeg" },
      body: bytes,
    });
    const complete = await app.inject({
      method: "POST",
      url: `/files/${upload.file.id}/complete`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(complete.statusCode).toBe(202);
    const start = Date.now();
    while (Date.now() - start < 15_000) {
      const row = await db.query.files.findFirst({ where: eq(schema.files.id, upload.file.id) });
      if (row && row.status !== "processing" && row.status !== "pending") {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    await db
      .update(schema.files)
      .set({ status: "ready", processingError: null, updatedAt: new Date() })
      .where(eq(schema.files.id, upload.file.id));

    const file = await db.query.files.findFirst({ where: eq(schema.files.id, upload.file.id) });
    expect(file?.storageKey).toBeTruthy();
    const key = file!.storageKey!;

    const del = await app.inject({
      method: "DELETE",
      url: `/sessions/${session.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(del.statusCode).toBe(200);

    const remainingFiles = await db.query.files.findMany({
      where: eq(schema.files.sessionId, session.id),
    });
    expect(remainingFiles).toHaveLength(0);

    // best-effort: object should be gone (or missing)
    const listed = await s3!.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: key,
      }),
    );
    expect(listed.KeyCount ?? 0).toBe(0);

    // cleanup safety
    try {
      await s3!.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    } catch {
      // ignore
    }
  });

  it("hides pending files from session and topic lists for teachers", async () => {
    const teacher = await teacherAuth(app, "09123000099");
    const group = await createGroup(app, teacher.accessToken, "کلاس pending");
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();
    const topic = (
      await app.inject({
        method: "POST",
        url: `/sessions/${session.id}/topics`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const pending = await app.inject({
      method: "POST",
      url: "/files/upload-url",
      headers: authHeader(teacher.accessToken),
      payload: {
        sessionId: session.id,
        topicId: topic.id,
        mimeType: "audio/mpeg",
        sizeBytes: 8,
        fileName: "orphan.mp3",
      },
    });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().file.status).toBe("pending");
    expect(pending.json().file.number).toBeNull();
    expect(pending.json().file.displayName).toBeNull();

    const topicDetail = await app.inject({
      method: "GET",
      url: `/topics/${topic.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(topicDetail.statusCode).toBe(200);
    expect(topicDetail.json().files.some((f: { status: string }) => f.status === "pending")).toBe(
      false,
    );
    expect(topicDetail.json().files).toHaveLength(0);

    const sessionDetail = await app.inject({
      method: "GET",
      url: `/sessions/${session.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(sessionDetail.statusCode).toBe(200);
    expect(sessionDetail.json().files.some((f: { status: string }) => f.status === "pending")).toBe(
      false,
    );
  });

  it("numbers concurrent prepares only when each complete runs", async () => {
    const teacher = await teacherAuth(app, "09123000110");
    const group = await createGroup(app, teacher.accessToken, "کلاس همزمان");
    const session = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/sessions`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    async function prepare(label: string) {
      const bytes = Buffer.from(`%PDF-1.4 ${label}`);
      const upload = await app.inject({
        method: "POST",
        url: "/files/upload-url",
        headers: authHeader(teacher.accessToken),
        payload: {
          sessionId: session.id,
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          fileName: `${label}.pdf`,
        },
      });
      expect(upload.statusCode).toBe(200);
      const body = upload.json();
      expect(body.file.number).toBeNull();
      expect(body.file.displayName).toBeNull();
      expect(body.file.status).toBe("pending");
      return { body, bytes };
    }

    const [first, second] = await Promise.all([prepare("a"), prepare("b")]);
    const preparedIds = [first.body.file.id, second.body.file.id].sort();
    const pendingRows = await db.query.files.findMany({
      where: eq(schema.files.sessionId, session.id),
    });
    expect(pendingRows.map((row) => row.id).sort()).toEqual(preparedIds);
    expect(pendingRows.every((row) => row.number == null)).toBe(true);

    async function finish(item: {
      body: { file: { id: string }; uploadUrl: string };
      bytes: Buffer;
    }) {
      const put = await fetch(item.body.uploadUrl, {
        method: "PUT",
        headers: { "content-type": "application/pdf" },
        body: item.bytes,
      });
      expect(put.ok).toBe(true);
      const complete = await app.inject({
        method: "POST",
        url: `/files/${item.body.file.id}/complete`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      });
      expect(complete.statusCode).toBe(200);
      return complete.json() as { number: number; displayName: string; id: string };
    }

    const doneFirst = await finish(first);
    const doneSecond = await finish(second);
    expect(doneFirst.number).toBe(1);
    expect(doneSecond.number).toBe(2);
    expect(doneFirst.displayName).toBe("PDF 1");
    expect(doneSecond.displayName).toBe("PDF 2");

    const again = await app.inject({
      method: "POST",
      url: `/files/${first.body.file.id}/complete`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().number).toBe(1);
    expect(again.json().displayName).toBe("PDF 1");

    const titled = await prepare("titled");
    const renamed = await app.inject({
      method: "PATCH",
      url: `/files/${titled.body.file.id}`,
      headers: authHeader(teacher.accessToken),
      payload: { title: "Lesson notes" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().displayName).toBe("Lesson notes");
    const doneTitled = await finish(titled);
    expect(doneTitled.number).toBe(3);
    expect(doneTitled.displayName).toBe("Lesson notes");

    const orphan = await prepare("orphan");
    const rows = await db.query.files.findMany({
      where: eq(schema.files.sessionId, session.id),
    });
    expect(rows.map((row) => row.id).sort()).toEqual(
      [...preparedIds, titled.body.file.id, orphan.body.file.id].sort(),
    );
    expect(rows.find((row) => row.id === orphan.body.file.id)?.number).toBeNull();

    const detail = await app.inject({
      method: "GET",
      url: `/sessions/${session.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(detail.statusCode).toBe(200);
    const listed = detail.json().files as Array<{ id: string; number: number; status: string }>;
    expect(listed.map((file) => file.id).sort()).toEqual(
      [doneFirst.id, doneSecond.id, doneTitled.id].sort(),
    );
    expect(listed.some((file) => file.id === orphan.body.file.id)).toBe(false);
    expect(listed.map((file) => file.number).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("lets a teacher send text on the class, session, and topic", async () => {
    const teacher = await teacherAuth(app, "09123000077");
    const group = await createGroup(app, teacher.accessToken);
    const sessionRes = await app.inject({
      method: "POST",
      url: `/groups/${group.id}/sessions`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(sessionRes.statusCode).toBe(200);
    const session = sessionRes.json() as { id: string };
    const topicRes = await app.inject({
      method: "POST",
      url: `/sessions/${session.id}/topics`,
      headers: authHeader(teacher.accessToken),
      payload: {},
    });
    expect(topicRes.statusCode).toBe(200);
    const topic = topicRes.json() as { id: string };

    const classText = await app.inject({
      method: "POST",
      url: "/files/text",
      headers: authHeader(teacher.accessToken),
      payload: { groupId: group.id, content: "Class note" },
    });
    expect(classText.statusCode).toBe(200);
    expect(classText.json()).toMatchObject({
      kind: "text",
      sessionId: null,
      topicId: null,
      displayName: "Text 1",
      textContent: "Class note",
    });

    const sessionText = await app.inject({
      method: "POST",
      url: "/files/text",
      headers: authHeader(teacher.accessToken),
      payload: { sessionId: session.id, content: "Session note" },
    });
    expect(sessionText.statusCode).toBe(200);
    expect(sessionText.json().displayName).toBe("Text 1");

    const topicText = await app.inject({
      method: "POST",
      url: "/files/text",
      headers: authHeader(teacher.accessToken),
      payload: { sessionId: session.id, topicId: topic.id, content: "Topic note" },
    });
    expect(topicText.statusCode).toBe(200);
    expect(topicText.json().displayName).toBe("Text 1");

    const listed = await app.inject({
      method: "GET",
      url: `/groups/${group.id}/files`,
      headers: authHeader(teacher.accessToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().files).toHaveLength(1);
    expect(listed.json().files[0].textContent).toBe("Class note");

    const sessionDetail = await app.inject({
      method: "GET",
      url: `/sessions/${session.id}`,
      headers: authHeader(teacher.accessToken),
    });
    const sessionFiles = sessionDetail.json().files as Array<{ textContent?: string }>;
    expect(sessionFiles.some((file) => file.textContent === "Session note")).toBe(true);
    expect(sessionFiles.some((file) => file.textContent === "Class note")).toBe(false);

    const student = await register(app, {
      phone: "09123000078",
      password: "password1",
      displayName: "Student",
    });
    const denied = await app.inject({
      method: "POST",
      url: "/files/text",
      headers: authHeader(student.body.accessToken),
      payload: { groupId: group.id, content: "nope" },
    });
    expect(denied.statusCode).toBe(403);
  });
});

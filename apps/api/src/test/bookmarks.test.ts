import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

describe("personal bookmarks", () => {
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

  async function createGroup(token: string, name: string) {
    const response = await app.inject({
      method: "POST",
      url: "/groups",
      headers: authHeader(token),
      payload: { name },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { id: string; name: string };
  }

  async function createSession(token: string, groupId: string) {
    const response = await app.inject({
      method: "POST",
      url: `/groups/${groupId}/sessions`,
      headers: authHeader(token),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { id: string };
  }

  async function insertFile(input: {
    groupId: string;
    sessionId: string;
    uploadedBy: string;
    number: number;
    kind: "audio" | "pdf";
    durationMs?: number | null;
    topicId?: string;
  }) {
    const [file] = await db
      .insert(schema.files)
      .values({
        groupId: input.groupId,
        sessionId: input.sessionId,
        topicId: input.topicId,
        kind: input.kind,
        number: input.number,
        storageKey: `tests/${input.kind}-${input.number}`,
        mimeType: input.kind === "pdf" ? "application/pdf" : "audio/mpeg",
        sizeBytes: 128,
        durationMs:
          input.durationMs === undefined
            ? input.kind === "audio"
              ? 5000
              : null
            : input.durationMs,
        status: "ready",
        uploadedBy: input.uploadedBy,
      })
      .returning();
    return file!;
  }

  it("bookmarks a pdf and an audio file", async () => {
    const teacher = await teacherAuth(app, "09126000001");
    const group = await createGroup(teacher.accessToken, "Class A");
    const session = await createSession(teacher.accessToken, group.id);
    const pdf = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "pdf",
    });
    const voice = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "audio",
      durationMs: 5000,
    });

    const pdfBookmark = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: pdf.id, note: "read this" },
    });
    expect(pdfBookmark.statusCode).toBe(201);
    expect(pdfBookmark.json()).toMatchObject({
      fileId: pdf.id,
      kind: "pdf",
      positionMs: null,
      note: "read this",
      available: true,
      file: {
        displayName: "PDF 1",
        groupDisplayName: "Class A",
        sessionDisplayName: "Session 1",
        topicId: null,
        topicDisplayName: null,
      },
    });
    expect(pdfBookmark.json().url).toEqual(expect.any(String));

    const audioBookmark = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: voice.id },
    });
    expect(audioBookmark.statusCode).toBe(201);
    expect(audioBookmark.json().kind).toBe("audio");
    expect(audioBookmark.json().positionMs).toBeNull();
  });

  it("stores several moments on one voice, rounds to the nearest second, and updates the note", async () => {
    const teacher = await teacherAuth(app, "09126000002");
    const group = await createGroup(teacher.accessToken, "Class A");
    const session = await createSession(teacher.accessToken, group.id);
    const voice = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "audio",
      durationMs: 5000,
    });

    const first = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: voice.id, positionMs: 1420 },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().positionMs).toBe(1000);

    const again = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: voice.id, positionMs: 1490, note: "new phrasal verb" },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().id).toBe(first.json().id);
    expect(again.json().positionMs).toBe(1000);
    expect(again.json().note).toBe("new phrasal verb");

    const later = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: voice.id, positionMs: 2600, note: "example" },
    });
    expect(later.statusCode).toBe(201);
    expect(later.json().id).not.toBe(first.json().id);
    expect(later.json().positionMs).toBe(3000);

    const listed = await app.inject({
      method: "GET",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json().items.map((item: { positionMs: number | null }) => item.positionMs),
    ).toEqual([3000, 1000]);
  });

  it("rejects a position on a pdf and a position past the duration", async () => {
    const teacher = await teacherAuth(app, "09126000003");
    const group = await createGroup(teacher.accessToken, "Class A");
    const session = await createSession(teacher.accessToken, group.id);
    const pdf = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "pdf",
    });
    const voice = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "audio",
      durationMs: 5000,
    });

    const onPdf = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: pdf.id, positionMs: 1000 },
    });
    expect(onPdf.statusCode).toBe(400);
    expect(onPdf.json().error.code).toBe("POSITION_NOT_ALLOWED");

    const tooFar = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: voice.id, positionMs: 5001 },
    });
    expect(tooFar.statusCode).toBe(400);
    expect(tooFar.json().error.code).toBe("POSITION_OUT_OF_RANGE");
  });

  it("hides another user's bookmark and rejects a file from a group they are not in", async () => {
    const owner = await teacherAuth(app, "09126000004");
    const other = await teacherAuth(app, "09126000005");
    const group = await createGroup(owner.accessToken, "Class A");
    const session = await createSession(owner.accessToken, group.id);
    const pdf = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: owner.user.id,
      number: 1,
      kind: "pdf",
    });
    const created = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(owner.accessToken),
      payload: { fileId: pdf.id },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    for (const path of [
      { method: "PATCH" as const, payload: { note: "nope" } },
      { method: "DELETE" as const },
    ]) {
      const response = await app.inject({
        method: path.method,
        url: `/bookmarks/${id}`,
        headers: authHeader(other.accessToken),
        payload: path.payload,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("BOOKMARK_NOT_FOUND");
    }

    const foreign = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(other.accessToken),
      payload: { fileId: pdf.id },
    });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json().error.code).toBe("GROUP_FORBIDDEN");
  });

  it("drops the url after the user leaves the group", async () => {
    const teacher = await teacherAuth(app, "09126000006");
    const group = await createGroup(teacher.accessToken, "Class");
    const session = await createSession(teacher.accessToken, group.id);
    const pdf = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "pdf",
    });
    const invite = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/invites`,
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json() as { code: string };
    const student = await register(app, {
      phone: "09126000007",
      password: "password1",
      displayName: "Student",
    });
    const joined = await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });
    expect(joined.statusCode).toBe(200);

    const created = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(student.body.accessToken),
      payload: { fileId: pdf.id },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().available).toBe(true);

    const removed = await app.inject({
      method: "DELETE",
      url: `/groups/${group.id}/members/${student.body.user.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(removed.statusCode).toBe(200);

    const listed = await app.inject({
      method: "GET",
      url: "/me/bookmarks",
      headers: authHeader(student.body.accessToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);
    expect(listed.json().items[0].available).toBe(false);
    expect(listed.json().items[0].url).toBeUndefined();
    expect(listed.json().items[0].fileId).toBe(pdf.id);
  });

  it("removes the bookmark when the file is deleted", async () => {
    const teacher = await teacherAuth(app, "09126000008");
    const group = await createGroup(teacher.accessToken, "Class");
    const session = await createSession(teacher.accessToken, group.id);
    const pdf = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "pdf",
    });
    const created = await app.inject({
      method: "POST",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
      payload: { fileId: pdf.id },
    });
    expect(created.statusCode).toBe(201);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/files/${pdf.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(deleted.statusCode).toBe(200);

    const listed = await app.inject({
      method: "GET",
      url: "/me/bookmarks",
      headers: authHeader(teacher.accessToken),
    });
    expect(listed.json().items).toEqual([]);
  });

  it("filters by kind and fileId", async () => {
    const teacher = await teacherAuth(app, "09126000009");
    const group = await createGroup(teacher.accessToken, "Class");
    const session = await createSession(teacher.accessToken, group.id);
    const pdf = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "pdf",
    });
    const voice = await insertFile({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "audio",
    });
    for (const fileId of [pdf.id, voice.id]) {
      const response = await app.inject({
        method: "POST",
        url: "/me/bookmarks",
        headers: authHeader(teacher.accessToken),
        payload: { fileId },
      });
      expect(response.statusCode).toBe(201);
    }

    const pdfs = await app.inject({
      method: "GET",
      url: "/me/bookmarks?kind=pdf",
      headers: authHeader(teacher.accessToken),
    });
    expect(pdfs.json().items.map((item: { fileId: string }) => item.fileId)).toEqual([pdf.id]);

    const one = await app.inject({
      method: "GET",
      url: `/me/bookmarks?fileId=${voice.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(one.json().items).toHaveLength(1);
    expect(one.json().items[0].kind).toBe("audio");
  });
});

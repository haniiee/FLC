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

describe("personal playlists", () => {
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

  async function insertAudio(input: {
    groupId: string;
    sessionId: string;
    uploadedBy: string;
    number: number;
    durationMs?: number;
    topicId?: string;
    status?: "ready" | "pending";
    kind?: "audio" | "pdf";
    storageKey?: string | null;
  }) {
    const [file] = await db
      .insert(schema.files)
      .values({
        groupId: input.groupId,
        sessionId: input.sessionId,
        topicId: input.topicId,
        kind: input.kind ?? "audio",
        number: input.number,
        storageKey:
          input.storageKey === undefined ? `tests/voice-${input.number}.m4a` : input.storageKey,
        mimeType: input.kind === "pdf" ? "application/pdf" : "audio/mpeg",
        sizeBytes: 128,
        durationMs: input.durationMs ?? 3000,
        status: input.status ?? "ready",
        uploadedBy: input.uploadedBy,
      })
      .returning();
    return file!;
  }

  it("assigns Playlist 1 and Playlist 2 when two creates run together", async () => {
    const teacher = await teacherAuth(app, "09125000001");
    const [first, second] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(teacher.accessToken),
        payload: {},
      }),
      app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(teacher.accessToken),
        payload: {},
      }),
    ]);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    const names = [first.json().displayName, second.json().displayName].sort();
    expect(names).toEqual(["Playlist 1", "Playlist 2"]);
    expect(first.json().error).toBeUndefined();
    expect(second.json().error).toBeUndefined();
  });

  it("appends voices from two groups, skips duplicates, and keeps order", async () => {
    const teacher = await teacherAuth(app, "09125000002");
    const classA = await createGroup(teacher.accessToken, "Class A");
    const classB = await createGroup(teacher.accessToken, "Class B");
    const sessionA = await createSession(teacher.accessToken, classA.id);
    const sessionB = await createSession(teacher.accessToken, classB.id);
    const topic = (
      await app.inject({
        method: "POST",
        url: `/sessions/${sessionA.id}/topics`,
        headers: authHeader(teacher.accessToken),
        payload: { title: "Warmup" },
      })
    ).json() as { id: string };
    const voiceA = await insertAudio({
      groupId: classA.id,
      sessionId: sessionA.id,
      topicId: topic.id,
      uploadedBy: teacher.user.id,
      number: 1,
      durationMs: 4000,
    });
    const voiceB = await insertAudio({
      groupId: classB.id,
      sessionId: sessionB.id,
      uploadedBy: teacher.user.id,
      number: 2,
      durationMs: 2500,
    });

    const created = await app.inject({
      method: "POST",
      url: "/me/playlists",
      headers: authHeader(teacher.accessToken),
      payload: { title: "Commute" },
    });
    expect(created.statusCode).toBe(201);
    const playlistId = created.json().id as string;

    const added = await app.inject({
      method: "POST",
      url: `/playlists/${playlistId}/items`,
      headers: authHeader(teacher.accessToken),
      payload: { fileIds: [voiceA.id, voiceB.id, voiceA.id] },
    });
    expect(added.statusCode).toBe(200);
    const body = added.json();
    expect(body.displayName).toBe("Commute");
    expect(body.itemCount).toBe(2);
    expect(body.totalDurationMs).toBe(6500);
    expect(body.items.map((item: { fileId: string }) => item.fileId)).toEqual([
      voiceA.id,
      voiceB.id,
    ]);
    expect(body.items[0]).toMatchObject({
      displayName: "Voice 1",
      topicDisplayName: "Warmup",
      groupId: classA.id,
      groupDisplayName: "Class A",
      sessionDisplayName: "Session 1",
      available: true,
      durationMs: 4000,
    });
    expect(body.items[0].url).toEqual(expect.any(String));
    expect(body.items[1].groupDisplayName).toBe("Class B");

    const renamed = await app.inject({
      method: "PATCH",
      url: `/playlists/${playlistId}`,
      headers: authHeader(teacher.accessToken),
      payload: { title: null },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().displayName).toBe("Playlist 1");
    expect(renamed.json().title).toBeNull();
  });

  it("reorders the current set and rejects a mismatched set", async () => {
    const teacher = await teacherAuth(app, "09125000003");
    const group = await createGroup(teacher.accessToken, "Class");
    const session = await createSession(teacher.accessToken, group.id);
    const first = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
    });
    const second = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 2,
    });
    const third = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 3,
    });
    const playlist = (
      await app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(teacher.accessToken),
        payload: { fileIds: [first.id, second.id, third.id] },
      })
    ).json();

    const reordered = await app.inject({
      method: "PUT",
      url: `/playlists/${playlist.id}/order`,
      headers: authHeader(teacher.accessToken),
      payload: { fileIds: [third.id, first.id, second.id] },
    });
    expect(reordered.statusCode).toBe(200);
    expect(reordered.json().items.map((item: { fileId: string }) => item.fileId)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);

    const mismatch = await app.inject({
      method: "PUT",
      url: `/playlists/${playlist.id}/order`,
      headers: authHeader(teacher.accessToken),
      payload: { fileIds: [third.id, first.id] },
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json().error.code).toBe("PLAYLIST_ORDER_MISMATCH");
  });

  it("rejects a file that is not ready audio, and a file outside the user's groups", async () => {
    const teacher = await teacherAuth(app, "09125000004");
    const outsider = await teacherAuth(app, "09125000005");
    const group = await createGroup(teacher.accessToken, "Mine");
    const session = await createSession(teacher.accessToken, group.id);
    const pending = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      status: "pending",
      storageKey: null,
    });
    const pdf = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
      kind: "pdf",
    });
    const foreignGroup = await createGroup(outsider.accessToken, "Theirs");
    const foreignSession = await createSession(outsider.accessToken, foreignGroup.id);
    const foreign = await insertAudio({
      groupId: foreignGroup.id,
      sessionId: foreignSession.id,
      uploadedBy: outsider.user.id,
      number: 1,
    });
    const playlist = (
      await app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(teacher.accessToken),
        payload: {},
      })
    ).json();

    const pendingAdd = await app.inject({
      method: "POST",
      url: `/playlists/${playlist.id}/items`,
      headers: authHeader(teacher.accessToken),
      payload: { fileIds: [pending.id] },
    });
    expect(pendingAdd.statusCode).toBe(400);
    expect(pendingAdd.json().error.code).toBe("FILE_NOT_PLAYABLE");

    const pdfAdd = await app.inject({
      method: "POST",
      url: `/playlists/${playlist.id}/items`,
      headers: authHeader(teacher.accessToken),
      payload: { fileIds: [pdf.id] },
    });
    expect(pdfAdd.statusCode).toBe(400);
    expect(pdfAdd.json().error.code).toBe("FILE_NOT_PLAYABLE");

    const foreignAdd = await app.inject({
      method: "POST",
      url: `/playlists/${playlist.id}/items`,
      headers: authHeader(teacher.accessToken),
      payload: { fileIds: [foreign.id] },
    });
    expect(foreignAdd.statusCode).toBe(403);
    expect(foreignAdd.json().error.code).toBe("GROUP_FORBIDDEN");
  });

  it("hides another user's playlist", async () => {
    const owner = await teacherAuth(app, "09125000006");
    const other = await register(app, {
      phone: "09125000007",
      password: "password1",
      displayName: "Other",
    });
    const playlist = (
      await app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(owner.accessToken),
        payload: {},
      })
    ).json();
    const token = other.body.accessToken as string;
    const paths: Array<{
      method: "GET" | "PATCH" | "DELETE" | "POST" | "PUT";
      url: string;
      payload?: Record<string, unknown>;
    }> = [
      { method: "GET", url: `/playlists/${playlist.id}` },
      { method: "PATCH", url: `/playlists/${playlist.id}`, payload: { title: "Nope" } },
      { method: "DELETE", url: `/playlists/${playlist.id}` },
      {
        method: "POST",
        url: `/playlists/${playlist.id}/items`,
        payload: { fileIds: [playlist.id] },
      },
      { method: "DELETE", url: `/playlists/${playlist.id}/items/${playlist.id}` },
      { method: "PUT", url: `/playlists/${playlist.id}/order`, payload: { fileIds: [] } },
    ];
    for (const path of paths) {
      const response = await app.inject({
        method: path.method,
        url: path.url,
        headers: authHeader(token),
        payload: path.payload,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("PLAYLIST_NOT_FOUND");
    }
  });

  it("keeps an item without a url after the owner leaves its group", async () => {
    const teacher = await teacherAuth(app, "09125000008");
    const group = await createGroup(teacher.accessToken, "Class");
    const session = await createSession(teacher.accessToken, group.id);
    const voice = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
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
      phone: "09125000009",
      password: "password1",
      displayName: "Student",
    });
    const joined = await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });
    expect(joined.statusCode).toBe(200);

    const playlist = (
      await app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(student.body.accessToken),
        payload: { fileIds: [voice.id] },
      })
    ).json();
    expect(playlist.items[0].available).toBe(true);

    const removed = await app.inject({
      method: "DELETE",
      url: `/groups/${group.id}/members/${student.body.user.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(removed.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: `/playlists/${playlist.id}`,
      headers: authHeader(student.body.accessToken),
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().items).toHaveLength(1);
    expect(after.json().items[0].available).toBe(false);
    expect(after.json().items[0].url).toBeUndefined();
    expect(after.json().items[0].fileId).toBe(voice.id);
  });

  it("drops a playlist item when its file is deleted", async () => {
    const teacher = await teacherAuth(app, "09125000010");
    const group = await createGroup(teacher.accessToken, "Class");
    const session = await createSession(teacher.accessToken, group.id);
    const voice = await insertAudio({
      groupId: group.id,
      sessionId: session.id,
      uploadedBy: teacher.user.id,
      number: 1,
    });
    const playlist = (
      await app.inject({
        method: "POST",
        url: "/me/playlists",
        headers: authHeader(teacher.accessToken),
        payload: { fileIds: [voice.id] },
      })
    ).json();

    const deleted = await app.inject({
      method: "DELETE",
      url: `/files/${voice.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(deleted.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: `/playlists/${playlist.id}`,
      headers: authHeader(teacher.accessToken),
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().items).toEqual([]);
    expect(after.json().itemCount).toBe(0);
  });
});

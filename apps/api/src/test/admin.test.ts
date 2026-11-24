import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { promoteAdminByPhone } from "../scripts/promote-admin";
import { verifyPassword } from "../lib/password";
import {
  authHeader,
  closeTestApp,
  createTestApp,
  db,
  login,
  register,
  resetDb,
  schema,
} from "./helpers";

async function promoteToAdmin(userId: string) {
  await db.update(schema.users).set({ platformRole: "admin" }).where(eq(schema.users.id, userId));
}

async function adminAuth(app: FastifyInstance, phone: string) {
  const registered = await register(app, {
    phone,
    password: "password1",
    displayName: "Admin",
  });
  await promoteToAdmin(registered.body.user.id);
  const loggedIn = await login(app, { phone, password: "password1" });
  return {
    user: loggedIn.body.user,
    accessToken: loggedIn.body.accessToken as string,
    refreshToken: loggedIn.body.refreshToken as string,
  };
}

describe("admin api", () => {
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

  it("rejects non-admin on admin endpoints", async () => {
    const user = await register(app, {
      phone: "09127000001",
      password: "password1",
      displayName: "User",
    });

    const endpoints = [
      { method: "GET" as const, url: "/admin/users" },
      {
        method: "POST" as const,
        url: "/admin/users",
        payload: { phone: "09127000099", displayName: "X" },
      },
      { method: "GET" as const, url: "/admin/groups" },
      {
        method: "POST" as const,
        url: "/admin/groups",
        payload: { name: "G", teacherUserId: user.body.user.id },
      },
    ];

    for (const endpoint of endpoints) {
      const response = await app.inject({
        ...endpoint,
        headers: authHeader(user.body.accessToken),
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("ADMIN_ONLY");
    }
  });

  it("creates user with generated password and gates until change-password", async () => {
    const admin = await adminAuth(app, "09127000002");

    const created = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: authHeader(admin.accessToken),
      payload: {
        phone: "09127000003",
        displayName: "New Student",
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.user.mustChangePassword).toBe(true);
    expect(body.initialPassword).toHaveLength(8);
    expect(body.initialPassword).toMatch(/^[A-Za-z2-9]+$/);
    expect(body.initialPassword).not.toMatch(/[0O1l]/);

    const loggedIn = await login(app, {
      phone: "09127000003",
      password: body.initialPassword,
    });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.mustChangePassword).toBe(true);

    const blocked = await app.inject({
      method: "GET",
      url: "/me/playlists",
      headers: authHeader(loggedIn.body.accessToken),
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const me = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(loggedIn.body.accessToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.mustChangePassword).toBe(true);

    const changed = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: authHeader(loggedIn.body.accessToken),
      payload: {
        currentPassword: body.initialPassword,
        newPassword: "newpassword1",
      },
    });
    expect(changed.statusCode).toBe(204);

    const afterLogin = await login(app, {
      phone: "09127000003",
      password: "newpassword1",
    });
    expect(afterLogin.status).toBe(200);
    expect(afterLogin.body.user.mustChangePassword).toBe(false);

    const playlists = await app.inject({
      method: "GET",
      url: "/me/playlists",
      headers: authHeader(afterLogin.body.accessToken),
    });
    expect(playlists.statusCode).toBe(200);
  });

  it("rejects duplicate phone on admin create", async () => {
    const admin = await adminAuth(app, "09127000004");
    await register(app, {
      phone: "09127000005",
      password: "password1",
      displayName: "Taken",
    });

    const created = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: authHeader(admin.accessToken),
      payload: {
        phone: "09127000005",
        displayName: "Dup",
      },
    });
    expect(created.statusCode).toBe(409);
    expect(created.json().error.code).toBe("PHONE_TAKEN");
  });

  it("creates group with teacher and chat channels", async () => {
    const admin = await adminAuth(app, "09127000006");
    const teacher = await register(app, {
      phone: "09127000007",
      password: "password1",
      displayName: "Teacher A",
    });

    const group = await app.inject({
      method: "POST",
      url: "/admin/groups",
      headers: authHeader(admin.accessToken),
      payload: {
        name: "Class Admin",
        teacherUserId: teacher.body.user.id,
      },
    });
    expect(group.statusCode).toBe(200);
    const body = group.json();
    expect(body.ownerId).toBe(teacher.body.user.id);
    expect(body.teacher.id).toBe(teacher.body.user.id);
    expect(body.assistantCount).toBe(0);
    expect(body.studentCount).toBe(0);

    const channels = await db.query.chatChannels.findMany({
      where: eq(schema.chatChannels.groupId, body.id),
    });
    expect(channels.map((c) => c.kind).sort()).toEqual(["all", "students"]);
  });

  it("transfers teacher with assistant and remove modes", async () => {
    const admin = await adminAuth(app, "09127000008");
    const teacherA = await register(app, {
      phone: "09127000009",
      password: "password1",
      displayName: "Teacher A",
    });
    const teacherB = await register(app, {
      phone: "09127000010",
      password: "password1",
      displayName: "Teacher B",
    });
    const teacherC = await register(app, {
      phone: "09127000011",
      password: "password1",
      displayName: "Teacher C",
    });

    const created = await app.inject({
      method: "POST",
      url: "/admin/groups",
      headers: authHeader(admin.accessToken),
      payload: { name: "Transfer", teacherUserId: teacherA.body.user.id },
    });
    const groupId = created.json().id as string;

    const asAssistant = await app.inject({
      method: "PUT",
      url: `/admin/groups/${groupId}/teacher`,
      headers: authHeader(admin.accessToken),
      payload: { userId: teacherB.body.user.id, previousTeacher: "assistant" },
    });
    expect(asAssistant.statusCode).toBe(200);
    expect(asAssistant.json().ownerId).toBe(teacherB.body.user.id);

    const membersAfter = await app.inject({
      method: "GET",
      url: `/admin/groups/${groupId}/members`,
      headers: authHeader(admin.accessToken),
    });
    const roles = Object.fromEntries(
      membersAfter.json().members.map((m: { id: string; role: string }) => [m.id, m.role]),
    );
    expect(roles[teacherB.body.user.id]).toBe("teacher");
    expect(roles[teacherA.body.user.id]).toBe("assistant");

    const removed = await app.inject({
      method: "PUT",
      url: `/admin/groups/${groupId}/teacher`,
      headers: authHeader(admin.accessToken),
      payload: { userId: teacherC.body.user.id, previousTeacher: "remove" },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().ownerId).toBe(teacherC.body.user.id);

    const membersFinal = await app.inject({
      method: "GET",
      url: `/admin/groups/${groupId}/members`,
      headers: authHeader(admin.accessToken),
    });
    const ids = membersFinal.json().members.map((m: { id: string }) => m.id);
    expect(ids).toContain(teacherC.body.user.id);
    expect(ids).toContain(teacherA.body.user.id);
    expect(ids).not.toContain(teacherB.body.user.id);
  });

  it("adds new and existing members and rejects duplicates", async () => {
    const admin = await adminAuth(app, "09127000012");
    const teacher = await register(app, {
      phone: "09127000013",
      password: "password1",
      displayName: "Teacher",
    });
    const group = await app.inject({
      method: "POST",
      url: "/admin/groups",
      headers: authHeader(admin.accessToken),
      payload: { name: "Members", teacherUserId: teacher.body.user.id },
    });
    const groupId = group.json().id as string;

    const newStudent = await app.inject({
      method: "POST",
      url: `/admin/groups/${groupId}/members`,
      headers: authHeader(admin.accessToken),
      payload: {
        role: "student",
        newUser: { phone: "09127000014", displayName: "Student New" },
      },
    });
    expect(newStudent.statusCode).toBe(200);
    expect(newStudent.json().initialPassword).toHaveLength(8);
    expect(newStudent.json().existing).toBeUndefined();

    const existingUser = await register(app, {
      phone: "09127000015",
      password: "keep-password",
      displayName: "Existing",
    });
    const beforeHash = (
      await db.query.users.findFirst({ where: eq(schema.users.id, existingUser.body.user.id) })
    )?.passwordHash;

    const addedExisting = await app.inject({
      method: "POST",
      url: `/admin/groups/${groupId}/members`,
      headers: authHeader(admin.accessToken),
      payload: {
        role: "assistant",
        newUser: { phone: "09127000015", displayName: "Ignored Name" },
      },
    });
    expect(addedExisting.statusCode).toBe(200);
    expect(addedExisting.json().existing).toBe(true);
    expect(addedExisting.json().initialPassword).toBeUndefined();

    const afterHash = (
      await db.query.users.findFirst({ where: eq(schema.users.id, existingUser.body.user.id) })
    )?.passwordHash;
    expect(afterHash).toBe(beforeHash);
    expect(await verifyPassword(afterHash!, "keep-password")).toBe(true);

    const duplicate = await app.inject({
      method: "POST",
      url: `/admin/groups/${groupId}/members`,
      headers: authHeader(admin.accessToken),
      payload: { role: "student", userId: existingUser.body.user.id },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("ALREADY_MEMBER");
  });

  it("updates and removes members but blocks teacher changes via member routes", async () => {
    const admin = await adminAuth(app, "09127000016");
    const teacher = await register(app, {
      phone: "09127000017",
      password: "password1",
      displayName: "Teacher",
    });
    const student = await register(app, {
      phone: "09127000018",
      password: "password1",
      displayName: "Student",
    });
    const group = await app.inject({
      method: "POST",
      url: "/admin/groups",
      headers: authHeader(admin.accessToken),
      payload: { name: "Roles", teacherUserId: teacher.body.user.id },
    });
    const groupId = group.json().id as string;

    await app.inject({
      method: "POST",
      url: `/admin/groups/${groupId}/members`,
      headers: authHeader(admin.accessToken),
      payload: { role: "student", userId: student.body.user.id },
    });

    const promoted = await app.inject({
      method: "PATCH",
      url: `/admin/groups/${groupId}/members/${student.body.user.id}`,
      headers: authHeader(admin.accessToken),
      payload: { role: "assistant" },
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.json().role).toBe("assistant");

    const teacherPatch = await app.inject({
      method: "PATCH",
      url: `/admin/groups/${groupId}/members/${teacher.body.user.id}`,
      headers: authHeader(admin.accessToken),
      payload: { role: "assistant" },
    });
    expect(teacherPatch.statusCode).toBe(400);
    expect(teacherPatch.json().error.code).toBe("USE_TEACHER_ENDPOINT");

    const teacherDelete = await app.inject({
      method: "DELETE",
      url: `/admin/groups/${groupId}/members/${teacher.body.user.id}`,
      headers: authHeader(admin.accessToken),
    });
    expect(teacherDelete.statusCode).toBe(400);
    expect(teacherDelete.json().error.code).toBe("CANNOT_REMOVE_TEACHER");

    const removed = await app.inject({
      method: "DELETE",
      url: `/admin/groups/${groupId}/members/${student.body.user.id}`,
      headers: authHeader(admin.accessToken),
    });
    expect(removed.statusCode).toBe(204);
  });

  it("reset-password revokes existing refresh tokens", async () => {
    const admin = await adminAuth(app, "09127000019");
    const user = await register(app, {
      phone: "09127000020",
      password: "password1",
      displayName: "Reset Me",
    });
    const oldRefresh = user.body.refreshToken as string;

    const reset = await app.inject({
      method: "POST",
      url: `/admin/users/${user.body.user.id}/reset-password`,
      headers: authHeader(admin.accessToken),
      payload: {},
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().initialPassword).toHaveLength(8);

    const reuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: oldRefresh },
    });
    expect(reuse.statusCode).toBe(401);

    const loginNew = await login(app, {
      phone: "09127000020",
      password: reset.json().initialPassword,
    });
    expect(loginNew.status).toBe(200);
    expect(loginNew.body.user.mustChangePassword).toBe(true);
  });

  it("promoteAdminByPhone promotes an existing user", async () => {
    const registered = await register(app, {
      phone: "09127000021",
      password: "password1",
      displayName: "Soon Admin",
    });

    const result = await promoteAdminByPhone("09127000021");
    expect(result.id).toBe(registered.body.user.id);

    const row = await db.query.users.findFirst({
      where: eq(schema.users.id, registered.body.user.id),
    });
    expect(row?.platformRole).toBe("admin");

    await expect(promoteAdminByPhone("09127000999")).rejects.toThrow(/User not found/);
  });
});

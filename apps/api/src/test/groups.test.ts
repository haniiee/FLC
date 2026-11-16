import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { authHeader, closeTestApp, createTestApp, db, register, resetDb, schema } from "./helpers";

async function promoteToTeacher(userId: string) {
  await db.update(schema.users).set({ platformRole: "teacher" }).where(eq(schema.users.id, userId));
}

describe("groups and invites", () => {
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

  it("forbids normal users from creating groups", async () => {
    const user = await register(app, {
      phone: "09121110001",
      password: "password1",
      displayName: "User",
    });

    const response = await app.inject({
      method: "POST",
      url: "/groups",
      headers: authHeader(user.body.accessToken),
      payload: { name: "کلاس" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("TEACHER_REQUIRED");
  });

  it("teacher creates group, invite, student joins", async () => {
    const teacherReg = await register(app, {
      phone: "09121110002",
      password: "password1",
      displayName: "معلم",
    });
    await promoteToTeacher(teacherReg.body.user.id);

    const teacherLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { phone: "09121110002", password: "password1" },
    });
    const teacherToken = teacherLogin.json().accessToken as string;

    const groupRes = await app.inject({
      method: "POST",
      url: "/groups",
      headers: authHeader(teacherToken),
      payload: { name: "کلاس A" },
    });
    expect(groupRes.statusCode).toBe(200);
    const group = groupRes.json();
    expect(group.myRole).toBe("teacher");
    expect(group.memberCount).toBe(1);

    const inviteRes = await app.inject({
      method: "POST",
      url: `/groups/${group.id}/invites`,
      headers: authHeader(teacherToken),
      payload: { maxUses: 2 },
    });
    expect(inviteRes.statusCode).toBe(200);
    const invite = inviteRes.json();
    expect(invite.code).toHaveLength(8);
    expect(invite.url).toContain(`/join/${invite.code}`);

    const student = await register(app, {
      phone: "09121110003",
      password: "password1",
      displayName: "دانشجو",
    });

    const join = await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });
    expect(join.statusCode).toBe(200);
    expect(join.json()).toMatchObject({
      groupId: group.id,
      role: "student",
      alreadyMember: false,
    });

    const joinAgain = await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });
    expect(joinAgain.statusCode).toBe(200);
    expect(joinAgain.json().alreadyMember).toBe(true);

    const members = await app.inject({
      method: "GET",
      url: `/groups/${group.id}/members`,
      headers: authHeader(student.body.accessToken),
    });
    expect(members.statusCode).toBe(200);
    const studentView = members
      .json()
      .members.find((member: { id: string }) => member.id === student.body.user.id);
    expect(studentView.role).toBe("student");
    expect(studentView.phone).toBeUndefined();
  });

  it("rejects expired, revoked, and exhausted invites", async () => {
    const teacherReg = await register(app, {
      phone: "09121110004",
      password: "password1",
      displayName: "معلم",
    });
    await promoteToTeacher(teacherReg.body.user.id);
    const teacherLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { phone: "09121110004", password: "password1" },
    });
    const teacherToken = teacherLogin.json().accessToken as string;

    const group = (
      await app.inject({
        method: "POST",
        url: "/groups",
        headers: authHeader(teacherToken),
        payload: { name: "کلاس B" },
      })
    ).json();

    const expiredInvite = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/invites`,
        headers: authHeader(teacherToken),
        payload: { expiresInHours: 1 },
      })
    ).json();

    await db
      .update(schema.groupInvites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.groupInvites.id, expiredInvite.id));

    const student = await register(app, {
      phone: "09121110005",
      password: "password1",
      displayName: "S1",
    });

    const expiredJoin = await app.inject({
      method: "POST",
      url: `/invites/${expiredInvite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });
    expect(expiredJoin.statusCode).toBe(400);
    expect(expiredJoin.json().error.code).toBe("INVITE_EXPIRED");

    const invite = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/invites`,
        headers: authHeader(teacherToken),
        payload: { maxUses: 1 },
      })
    ).json();

    await app.inject({
      method: "DELETE",
      url: `/groups/${group.id}/invites/${invite.id}`,
      headers: authHeader(teacherToken),
    });

    const revokedJoin = await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });
    expect(revokedJoin.statusCode).toBe(400);
    expect(revokedJoin.json().error.code).toBe("INVITE_REVOKED");

    const limited = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/invites`,
        headers: authHeader(teacherToken),
        payload: { maxUses: 1 },
      })
    ).json();

    const s2 = await register(app, {
      phone: "09121110006",
      password: "password1",
      displayName: "S2",
    });

    expect(
      (
        await app.inject({
          method: "POST",
          url: `/invites/${limited.code}/join`,
          headers: authHeader(student.body.accessToken),
        })
      ).statusCode,
    ).toBe(200);

    const exhausted = await app.inject({
      method: "POST",
      url: `/invites/${limited.code}/join`,
      headers: authHeader(s2.body.accessToken),
    });
    expect(exhausted.statusCode).toBe(400);
    expect(exhausted.json().error.code).toBe("INVITE_EXHAUSTED");
  });

  it("enforces member management permissions", async () => {
    const teacherReg = await register(app, {
      phone: "09121110007",
      password: "password1",
      displayName: "معلم",
    });
    await promoteToTeacher(teacherReg.body.user.id);
    const teacherToken = (
      await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { phone: "09121110007", password: "password1" },
      })
    ).json().accessToken as string;

    const group = (
      await app.inject({
        method: "POST",
        url: "/groups",
        headers: authHeader(teacherToken),
        payload: { name: "کلاس C" },
      })
    ).json();

    const invite = (
      await app.inject({
        method: "POST",
        url: `/groups/${group.id}/invites`,
        headers: authHeader(teacherToken),
        payload: {},
      })
    ).json();

    const student = await register(app, {
      phone: "09121110008",
      password: "password1",
      displayName: "Student",
    });
    await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(student.body.accessToken),
    });

    const assistantUser = await register(app, {
      phone: "09121110009",
      password: "password1",
      displayName: "Assistant",
    });
    await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(assistantUser.body.accessToken),
    });
    await app.inject({
      method: "PATCH",
      url: `/groups/${group.id}/members/${assistantUser.body.user.id}`,
      headers: authHeader(teacherToken),
      payload: { role: "assistant" },
    });

    const assistantToken = (
      await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { phone: "09121110009", password: "password1" },
      })
    ).json().accessToken as string;

    const studentInviteAttempt = await app.inject({
      method: "POST",
      url: `/groups/${group.id}/invites`,
      headers: authHeader(student.body.accessToken),
      payload: {},
    });
    expect(studentInviteAttempt.statusCode).toBe(403);

    const studentRemoveAttempt = await app.inject({
      method: "DELETE",
      url: `/groups/${group.id}/members/${assistantUser.body.user.id}`,
      headers: authHeader(student.body.accessToken),
    });
    expect(studentRemoveAttempt.statusCode).toBe(403);

    const otherAssistant = await register(app, {
      phone: "09121110010",
      password: "password1",
      displayName: "Assistant2",
    });
    await app.inject({
      method: "POST",
      url: `/invites/${invite.code}/join`,
      headers: authHeader(otherAssistant.body.accessToken),
    });
    await app.inject({
      method: "PATCH",
      url: `/groups/${group.id}/members/${otherAssistant.body.user.id}`,
      headers: authHeader(teacherToken),
      payload: { role: "assistant" },
    });

    const assistantRemoveAssistant = await app.inject({
      method: "DELETE",
      url: `/groups/${group.id}/members/${otherAssistant.body.user.id}`,
      headers: authHeader(assistantToken),
    });
    expect(assistantRemoveAssistant.statusCode).toBe(403);
    expect(assistantRemoveAssistant.json().error.code).toBe("ASSISTANT_LIMIT");

    const assistantRemoveStudent = await app.inject({
      method: "DELETE",
      url: `/groups/${group.id}/members/${student.body.user.id}`,
      headers: authHeader(assistantToken),
    });
    expect(assistantRemoveStudent.statusCode).toBe(200);
  });
});

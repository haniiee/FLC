import type { FastifyInstance } from "fastify";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { buildApp } from "../app";
import { db, sql } from "../db";
import * as schema from "../db/schema";

export async function resetDb(): Promise<void> {
  await db.execute(
    drizzleSql.raw(`
    TRUNCATE TABLE
      files,
      topics,
      sessions,
      refresh_tokens,
      group_invites,
      group_members,
      groups,
      users
    RESTART IDENTITY CASCADE
  `),
  );
}

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}

export function authHeader(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

export async function register(
  app: FastifyInstance,
  input: { phone: string; password: string; displayName: string },
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: input,
  });
  return {
    status: response.statusCode,
    body: response.json(),
  };
}

export async function login(app: FastifyInstance, input: { phone: string; password: string }) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: input,
  });
  return {
    status: response.statusCode,
    body: response.json(),
  };
}

export async function promoteToTeacher(userId: string) {
  await db.update(schema.users).set({ platformRole: "teacher" }).where(eq(schema.users.id, userId));
}

export async function teacherAuth(app: FastifyInstance, phone: string) {
  const registered = await register(app, {
    phone,
    password: "password1",
    displayName: "Teacher",
  });
  await promoteToTeacher(registered.body.user.id);
  const loggedIn = await login(app, { phone, password: "password1" });
  return {
    user: loggedIn.body.user,
    accessToken: loggedIn.body.accessToken as string,
    refreshToken: loggedIn.body.refreshToken as string,
  };
}

export { db, schema, sql };

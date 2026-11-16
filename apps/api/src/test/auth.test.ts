import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
import type { FastifyInstance } from "fastify";

describe("auth", () => {
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

  it("registers and logs in with normalized phone", async () => {
    const registered = await register(app, {
      phone: "+98۹۱۲۳۴۵۶۷۸۹",
      password: "password1",
      displayName: "کاربر یک",
    });

    expect(registered.status).toBe(200);
    expect(registered.body.user.phone).toBe("09123456789");
    expect(registered.body.accessToken).toBeTruthy();
    expect(registered.body.refreshToken).toBeTruthy();

    const loggedIn = await login(app, {
      phone: "9123456789",
      password: "password1",
    });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.id).toBe(registered.body.user.id);
  });

  it("rejects invalid phone", async () => {
    const result = await register(app, {
      phone: "123",
      password: "password1",
      displayName: "بد",
    });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("INVALID_PHONE");
  });

  it("refreshes tokens with rotation", async () => {
    const registered = await register(app, {
      phone: "09120000001",
      password: "password1",
      displayName: "A",
    });

    const firstRefresh = registered.body.refreshToken as string;
    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: firstRefresh },
    });

    expect(refreshed.statusCode).toBe(200);
    const body = refreshed.json();
    expect(body.refreshToken).not.toBe(firstRefresh);

    const reuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: firstRefresh },
    });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().error.code).toBe("REFRESH_TOKEN_REUSE");

    const tokens = await db.query.refreshTokens.findMany({
      where: eq(schema.refreshTokens.userId, registered.body.user.id),
    });
    expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);
  });

  it("returns current user on /me", async () => {
    const registered = await register(app, {
      phone: "09120000002",
      password: "password1",
      displayName: "Me",
    });

    const me = await app.inject({
      method: "GET",
      url: "/me",
      headers: authHeader(registered.body.accessToken),
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().user.displayName).toBe("Me");
  });

  it("allows only one concurrent refresh to succeed", async () => {
    const registered = await register(app, {
      phone: "09120000003",
      password: "password1",
      displayName: "Race",
    });
    const token = registered.body.refreshToken as string;

    const [a, b] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: token },
      }),
      app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: token },
      }),
    ]);

    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 401]);
    const failed = a.statusCode === 401 ? a : b;
    expect(failed.json().error.code).toBe("REFRESH_TOKEN_REUSE");
  });
});

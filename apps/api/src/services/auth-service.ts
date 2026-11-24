import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { PlatformRole } from "@app/shared-types";
import { db } from "../db";
import { refreshTokens, users, type User } from "../db/schema";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashToken,
} from "../lib/tokens";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "../lib/password";
import { normalizePhone } from "../lib/phone";
import { badRequest, conflict, unauthorized } from "../lib/errors";
import { toUserDto } from "../lib/mappers";
import type { AuthResponse } from "@app/shared-types";

export type JwtPayload = {
  sub: string;
  platformRole: PlatformRole;
};

async function issueRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function issueAuthTokens(app: FastifyInstance, user: User): Promise<AuthResponse> {
  const accessToken = await app.jwt.sign(
    {
      sub: user.id,
      platformRole: user.platformRole,
    } satisfies JwtPayload,
    { expiresIn: ACCESS_TOKEN_TTL },
  );

  const refreshToken = await issueRefreshToken(user.id);

  return {
    user: toUserDto(user),
    accessToken,
    refreshToken,
  };
}

export async function registerUser(
  app: FastifyInstance,
  input: { phone: string; password: string; displayName: string },
): Promise<AuthResponse> {
  const phone = normalizePhone(input.phone);
  const passwordHash = await hashPassword(input.password);

  const existing = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });
  if (existing) {
    throw conflict("PHONE_TAKEN", "این شماره قبلاً ثبت شده است");
  }

  const [user] = await db
    .insert(users)
    .values({
      phone,
      displayName: input.displayName.trim(),
      passwordHash,
      platformRole: "user",
    })
    .returning();

  if (!user) {
    throw badRequest("REGISTER_FAILED", "ثبت‌نام ناموفق بود");
  }

  return issueAuthTokens(app, user);
}

export async function loginUser(
  app: FastifyInstance,
  input: { phone: string; password: string },
): Promise<AuthResponse> {
  const phone = normalizePhone(input.phone);
  const user = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw unauthorized("INVALID_CREDENTIALS", "شماره یا رمز عبور نادرست است");
  }

  return issueAuthTokens(app, user);
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    throw unauthorized();
  }

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw unauthorized("INVALID_CREDENTIALS", "رمز عبور فعلی نادرست است");
  }

  assertPasswordPolicy(input.newPassword);
  const passwordHash = await hashPassword(input.newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
    })
    .where(eq(users.id, userId));

  await revokeAllUserRefreshTokens(userId);
}

export async function refreshAuthTokens(
  app: FastifyInstance,
  refreshToken: string,
): Promise<AuthResponse> {
  const tokenHash = hashToken(refreshToken);
  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });

  if (!stored) {
    throw unauthorized("INVALID_REFRESH_TOKEN", "توکن نامعتبر است");
  }

  if (stored.revokedAt) {
    await revokeAllUserRefreshTokens(stored.userId);
    throw unauthorized("REFRESH_TOKEN_REUSE", "توکن قبلاً استفاده شده است");
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("REFRESH_TOKEN_EXPIRED", "توکن منقضی شده است");
  }

  const [revoked] = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });

  if (!revoked) {
    await revokeAllUserRefreshTokens(stored.userId);
    throw unauthorized("REFRESH_TOKEN_REUSE", "توکن قبلاً استفاده شده است");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, stored.userId),
  });

  if (!user) {
    throw unauthorized("INVALID_REFRESH_TOKEN", "توکن نامعتبر است");
  }

  return issueAuthTokens(app, user);
}

export async function logoutRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}

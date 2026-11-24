import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  AuthResponseSchema,
  ChangePasswordBodySchema,
  LoginBodySchema,
  LogoutBodySchema,
  MeResponseSchema,
  OkResponseSchema,
  RefreshBodySchema,
  RegisterBodySchema,
} from "@app/shared-types";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { toUserDto } from "../lib/mappers";
import { unauthorized } from "../lib/errors";
import {
  changePassword,
  loginUser,
  logoutRefreshToken,
  refreshAuthTokens,
  registerUser,
} from "../services/auth-service";

export const authRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/auth/register",
    {
      schema: {
        body: RegisterBodySchema,
        response: { 200: AuthResponseSchema },
      },
    },
    async (request) => registerUser(app, request.body),
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: LoginBodySchema,
        response: { 200: AuthResponseSchema },
      },
    },
    async (request) => loginUser(app, request.body),
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        body: RefreshBodySchema,
        response: { 200: AuthResponseSchema },
      },
    },
    async (request) => refreshAuthTokens(app, request.body.refreshToken),
  );

  app.post(
    "/auth/logout",
    {
      schema: {
        body: LogoutBodySchema,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      await logoutRefreshToken(request.body.refreshToken);
      return { ok: true as const };
    },
  );

  app.post(
    "/auth/change-password",
    {
      schema: {
        body: ChangePasswordBodySchema,
      },
    },
    async (request, reply) => {
      await app.authenticate(request);
      await changePassword(request.user.sub, request.body);
      return reply.code(204).send();
    },
  );

  app.get(
    "/me",
    {
      schema: {
        response: { 200: MeResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      const user = await db.query.users.findFirst({
        where: eq(users.id, request.user.sub),
      });
      if (!user) {
        throw unauthorized();
      }
      return { user: toUserDto(user) };
    },
  );
};

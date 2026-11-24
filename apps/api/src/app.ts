import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./env";
import { AppError } from "./lib/errors";
import { registerAuthDecorator } from "./plugins/auth";
import { attachRealtime, closeRealtime } from "./realtime";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { contentRoutes } from "./routes/content";
import { groupRoutes } from "./routes/groups";
import { healthRoutes } from "./routes/health";
import { inviteRoutes } from "./routes/invites";
import { bookmarkRoutes } from "./routes/bookmarks";
import { playlistRoutes } from "./routes/playlists";

export async function buildApp(options?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options?.logger ?? true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });
  await app.register(cookie);
  await app.register(sensible);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });
  await app.register(rateLimit, {
    global: false,
    max: 20,
    timeWindow: "10 seconds",
    keyGenerator: (request) => {
      const auth = request.headers.authorization;
      if (typeof auth === "string" && auth.length > 0) {
        return auth;
      }
      return request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests, retry after ${context.after}`,
      },
    }),
  });

  registerAuthDecorator(app);

  app.setErrorHandler((error: FastifyError | AppError | Error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if ("validation" in error && error.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    const statusCode =
      "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;

    // @fastify/rate-limit may attach statusCode 429 with a shaped payload already.
    if (statusCode === 429 && "error" in error) {
      return reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: error.message || "Too many requests",
        },
      });
    }

    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.status(statusCode).send({
      error: {
        code: "code" in error && typeof error.code === "string" ? error.code : "INTERNAL_ERROR",
        message: error.message || "Internal server error",
      },
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(groupRoutes);
  await app.register(inviteRoutes);
  await app.register(contentRoutes);
  await app.register(playlistRoutes);
  await app.register(bookmarkRoutes);
  await app.register(chatRoutes);

  app.addHook("onReady", async () => {
    attachRealtime(app);
  });

  app.addHook("onClose", async () => {
    await closeRealtime();
  });

  return app;
}

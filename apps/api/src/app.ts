import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./env";
import { AppError } from "./lib/errors";
import { registerAuthDecorator } from "./plugins/auth";
import { authRoutes } from "./routes/auth";
import { contentRoutes } from "./routes/content";
import { groupRoutes } from "./routes/groups";
import { healthRoutes } from "./routes/health";
import { inviteRoutes } from "./routes/invites";

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
  await app.register(groupRoutes);
  await app.register(inviteRoutes);
  await app.register(contentRoutes);

  return app;
}

import type { FastifyInstance, FastifyRequest } from "fastify";
import { unauthorized } from "../lib/errors";
import type { JwtPayload } from "../services/auth-service";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

export function registerAuthDecorator(app: FastifyInstance): void {
  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
  });
}

import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db";
import { users } from "../db/schema";
import { forbidden, unauthorized } from "../lib/errors";
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

const PASSWORD_CHANGE_ALLOWED = new Set(["GET /me", "POST /auth/change-password"]);

export function registerAuthDecorator(app: FastifyInstance): void {
  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, request.user.sub),
      columns: { mustChangePassword: true },
    });
    if (!user) {
      throw unauthorized();
    }

    if (user.mustChangePassword) {
      const routeKey = `${request.method} ${request.routeOptions.url ?? request.url}`;
      if (!PASSWORD_CHANGE_ALLOWED.has(routeKey)) {
        throw forbidden("PASSWORD_CHANGE_REQUIRED", "باید رمز عبور را تغییر دهید");
      }
    }
  });
}

import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db";
import { users, type User } from "../db/schema";
import { forbidden } from "./errors";

export async function requireAdmin(app: FastifyInstance, request: FastifyRequest): Promise<User> {
  await app.authenticate(request);

  const user = await db.query.users.findFirst({
    where: eq(users.id, request.user.sub),
  });

  if (!user || user.platformRole !== "admin") {
    throw forbidden("ADMIN_ONLY", "فقط مدیر سیستم به این بخش دسترسی دارد");
  }

  return user;
}

import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GroupRole } from "@app/shared-types";
import { db } from "../db";
import { groupMembers } from "../db/schema";
import { forbidden } from "./errors";

export async function requireGroupRole(
  app: FastifyInstance,
  request: FastifyRequest,
  groupId: string,
  roles: GroupRole[],
): Promise<GroupRole> {
  await app.authenticate(request);

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, request.user.sub)),
  });

  if (!membership || !roles.includes(membership.role)) {
    throw forbidden("GROUP_FORBIDDEN", "دسترسی به این گروه مجاز نیست");
  }

  return membership.role;
}

export async function getMembership(groupId: string, userId: string) {
  return db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });
}

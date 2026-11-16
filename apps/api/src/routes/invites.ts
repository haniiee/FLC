import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, eq } from "drizzle-orm";
import { JoinInviteResponseSchema, PublicInviteSchema } from "@app/shared-types";
import { z } from "zod";
import { db } from "../db";
import { groupInvites, groupMembers, users } from "../db/schema";
import { badRequest, notFound } from "../lib/errors";
import { isInviteValid } from "../lib/mappers";

const CodeParams = z.object({ code: z.string().min(1) });

export const inviteRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/invites/:code",
    {
      schema: {
        params: CodeParams,
        response: { 200: PublicInviteSchema },
      },
    },
    async (request) => {
      const invite = await db.query.groupInvites.findFirst({
        where: eq(groupInvites.code, request.params.code.toUpperCase()),
        with: {
          group: true,
        },
      });

      if (!invite) {
        throw notFound("INVITE_NOT_FOUND", "دعوت‌نامه پیدا نشد");
      }

      const teacher = await db.query.users.findFirst({
        where: eq(users.id, invite.group.ownerId),
      });

      return {
        groupName: invite.group.name,
        teacherName: teacher?.displayName ?? "معلم",
        valid: isInviteValid(invite),
      };
    },
  );

  app.post(
    "/invites/:code/join",
    {
      schema: {
        params: CodeParams,
        response: { 200: JoinInviteResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);

      return db.transaction(async (tx) => {
        const invite = await tx.query.groupInvites.findFirst({
          where: eq(groupInvites.code, request.params.code.toUpperCase()),
        });

        if (!invite) {
          throw notFound("INVITE_NOT_FOUND", "دعوت‌نامه پیدا نشد");
        }

        if (invite.revokedAt) {
          throw badRequest("INVITE_REVOKED", "دعوت‌نامه لغو شده است");
        }
        if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
          throw badRequest("INVITE_EXPIRED", "دعوت‌نامه منقضی شده است");
        }
        if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
          throw badRequest("INVITE_EXHAUSTED", "ظرفیت دعوت‌نامه تکمیل شده است");
        }

        const existing = await tx.query.groupMembers.findFirst({
          where: and(
            eq(groupMembers.groupId, invite.groupId),
            eq(groupMembers.userId, request.user.sub),
          ),
        });

        if (existing) {
          return {
            groupId: invite.groupId,
            role: existing.role,
            alreadyMember: true,
          };
        }

        await tx.insert(groupMembers).values({
          groupId: invite.groupId,
          userId: request.user.sub,
          role: "student",
        });

        await tx
          .update(groupInvites)
          .set({ uses: invite.uses + 1 })
          .where(eq(groupInvites.id, invite.id));

        return {
          groupId: invite.groupId,
          role: "student" as const,
          alreadyMember: false,
        };
      });
    },
  );
};

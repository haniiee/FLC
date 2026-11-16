import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, count, eq } from "drizzle-orm";
import {
  CreateGroupBodySchema,
  CreateInviteBodySchema,
  GroupDetailSchema,
  GroupMembersResponseSchema,
  GroupsListResponseSchema,
  GroupSummarySchema,
  InviteSchema,
  InvitesListResponseSchema,
  OkResponseSchema,
  UpdateGroupBodySchema,
  UpdateMemberRoleBodySchema,
} from "@app/shared-types";
import { z } from "zod";
import { db } from "../db";
import { groupInvites, groupMembers, groups } from "../db/schema";
import { getMembership, requireGroupRole } from "../lib/group-access";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { toInviteDto } from "../lib/mappers";
import { generateInviteCode } from "../lib/tokens";

const GroupIdParams = z.object({ id: z.string().uuid() });
const MemberParams = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});
const InviteParams = z.object({
  id: z.string().uuid(),
  inviteId: z.string().uuid(),
});

export const groupRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/groups",
    {
      schema: {
        body: CreateGroupBodySchema,
        response: { 200: GroupSummarySchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      if (request.user.platformRole !== "teacher") {
        throw forbidden("TEACHER_REQUIRED", "فقط معلم می‌تواند گروه بسازد");
      }

      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [group] = await tx
          .insert(groups)
          .values({
            name: request.body.name.trim(),
            ownerId: request.user.sub,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!group) {
          throw badRequest("GROUP_CREATE_FAILED", "ساخت گروه ناموفق بود");
        }

        await tx.insert(groupMembers).values({
          groupId: group.id,
          userId: request.user.sub,
          role: "teacher",
        });

        return group;
      });

      return {
        id: result.id,
        name: result.name,
        ownerId: result.ownerId,
        myRole: "teacher" as const,
        memberCount: 1,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };
    },
  );

  app.get(
    "/groups",
    {
      schema: {
        response: { 200: GroupsListResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);

      const memberships = await db.query.groupMembers.findMany({
        where: eq(groupMembers.userId, request.user.sub),
        with: {
          group: true,
        },
      });

      const groupsList = await Promise.all(
        memberships.map(async (membership) => {
          const [row] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(eq(groupMembers.groupId, membership.groupId));

          return {
            id: membership.group.id,
            name: membership.group.name,
            ownerId: membership.group.ownerId,
            myRole: membership.role,
            memberCount: Number(row?.value ?? 0),
            createdAt: membership.group.createdAt.toISOString(),
            updatedAt: membership.group.updatedAt.toISOString(),
          };
        }),
      );

      return { groups: groupsList };
    },
  );

  app.get(
    "/groups/:id",
    {
      schema: {
        params: GroupIdParams,
        response: { 200: GroupDetailSchema },
      },
    },
    async (request) => {
      const myRole = await requireGroupRole(app, request, request.params.id, [
        "teacher",
        "assistant",
        "student",
      ]);

      const group = await db.query.groups.findFirst({
        where: eq(groups.id, request.params.id),
      });
      if (!group) {
        throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
      }

      return {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        myRole,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      };
    },
  );

  app.patch(
    "/groups/:id",
    {
      schema: {
        params: GroupIdParams,
        body: UpdateGroupBodySchema,
        response: { 200: GroupDetailSchema },
      },
    },
    async (request) => {
      await requireGroupRole(app, request, request.params.id, ["teacher"]);

      const [group] = await db
        .update(groups)
        .set({
          name: request.body.name.trim(),
          updatedAt: new Date(),
        })
        .where(eq(groups.id, request.params.id))
        .returning();

      if (!group) {
        throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
      }

      return {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        myRole: "teacher" as const,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      };
    },
  );

  app.get(
    "/groups/:id/members",
    {
      schema: {
        params: GroupIdParams,
        response: { 200: GroupMembersResponseSchema },
      },
    },
    async (request) => {
      const myRole = await requireGroupRole(app, request, request.params.id, [
        "teacher",
        "assistant",
        "student",
      ]);

      const members = await db.query.groupMembers.findMany({
        where: eq(groupMembers.groupId, request.params.id),
        with: { user: true },
      });

      const includePhone = myRole === "teacher" || myRole === "assistant";

      return {
        members: members.map((member) => ({
          id: member.user.id,
          displayName: member.user.displayName,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
          ...(includePhone ? { phone: member.user.phone } : {}),
        })),
      };
    },
  );

  app.patch(
    "/groups/:id/members/:userId",
    {
      schema: {
        params: MemberParams,
        body: UpdateMemberRoleBodySchema,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      await requireGroupRole(app, request, request.params.id, ["teacher"]);

      const target = await getMembership(request.params.id, request.params.userId);
      if (!target) {
        throw notFound("MEMBER_NOT_FOUND", "عضو پیدا نشد");
      }
      if (target.role === "teacher") {
        throw forbidden("TEACHER_ROLE_LOCKED", "نقش معلم قابل تغییر نیست");
      }

      await db
        .update(groupMembers)
        .set({ role: request.body.role })
        .where(
          and(
            eq(groupMembers.groupId, request.params.id),
            eq(groupMembers.userId, request.params.userId),
          ),
        );

      return { ok: true as const };
    },
  );

  app.delete(
    "/groups/:id/members/:userId",
    {
      schema: {
        params: MemberParams,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      const myRole = await requireGroupRole(app, request, request.params.id, [
        "teacher",
        "assistant",
      ]);

      if (request.params.userId === request.user.sub) {
        throw badRequest("CANNOT_REMOVE_SELF", "نمی‌توانید خودتان را حذف کنید");
      }

      const target = await getMembership(request.params.id, request.params.userId);
      if (!target) {
        throw notFound("MEMBER_NOT_FOUND", "عضو پیدا نشد");
      }

      if (myRole === "assistant" && target.role !== "student") {
        throw forbidden("ASSISTANT_LIMIT", "دستیار فقط می‌تواند دانشجو را حذف کند");
      }

      await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, request.params.id),
            eq(groupMembers.userId, request.params.userId),
          ),
        );

      return { ok: true as const };
    },
  );

  app.post(
    "/groups/:id/invites",
    {
      schema: {
        params: GroupIdParams,
        body: CreateInviteBodySchema,
        response: { 200: InviteSchema },
      },
    },
    async (request) => {
      await requireGroupRole(app, request, request.params.id, ["teacher", "assistant"]);

      const expiresAt =
        request.body.expiresInHours !== undefined
          ? new Date(Date.now() + request.body.expiresInHours * 60 * 60 * 1000)
          : null;

      const [invite] = await db
        .insert(groupInvites)
        .values({
          groupId: request.params.id,
          code: generateInviteCode(),
          createdBy: request.user.sub,
          expiresAt,
          maxUses: request.body.maxUses ?? null,
        })
        .returning();

      if (!invite) {
        throw badRequest("INVITE_CREATE_FAILED", "ساخت دعوت‌نامه ناموفق بود");
      }

      return toInviteDto(invite);
    },
  );

  app.get(
    "/groups/:id/invites",
    {
      schema: {
        params: GroupIdParams,
        response: { 200: InvitesListResponseSchema },
      },
    },
    async (request) => {
      await requireGroupRole(app, request, request.params.id, ["teacher", "assistant"]);

      const invites = await db.query.groupInvites.findMany({
        where: eq(groupInvites.groupId, request.params.id),
      });

      return { invites: invites.map(toInviteDto) };
    },
  );

  app.delete(
    "/groups/:id/invites/:inviteId",
    {
      schema: {
        params: InviteParams,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      await requireGroupRole(app, request, request.params.id, ["teacher", "assistant"]);

      const invite = await db.query.groupInvites.findFirst({
        where: and(
          eq(groupInvites.id, request.params.inviteId),
          eq(groupInvites.groupId, request.params.id),
        ),
      });
      if (!invite) {
        throw notFound("INVITE_NOT_FOUND", "دعوت‌نامه پیدا نشد");
      }

      await db
        .update(groupInvites)
        .set({ revokedAt: new Date() })
        .where(eq(groupInvites.id, invite.id));

      return { ok: true as const };
    },
  );
};

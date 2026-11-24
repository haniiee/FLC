import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  AddAdminMemberBodySchema,
  AddAdminMemberResponseSchema,
  AdminGroupSchema,
  AdminGroupsListResponseSchema,
  AdminGroupsQuerySchema,
  AdminMembersListResponseSchema,
  AdminMemberSchema,
  AdminUsersListResponseSchema,
  AdminUsersQuerySchema,
  CreateAdminGroupBodySchema,
  CreateAdminUserBodySchema,
  CreateAdminUserResponseSchema,
  ResetAdminPasswordBodySchema,
  ResetAdminPasswordResponseSchema,
  SetAdminGroupTeacherBodySchema,
  UpdateAdminGroupBodySchema,
  UpdateAdminMemberBodySchema,
} from "@app/shared-types";
import { z } from "zod";
import { requireAdmin } from "../lib/admin-access";
import {
  addAdminMember,
  createAdminGroup,
  createAdminUser,
  listAdminGroups,
  listAdminMembers,
  listAdminUsers,
  removeAdminMember,
  resetAdminUserPassword,
  setAdminGroupTeacher,
  updateAdminGroup,
  updateAdminMember,
} from "../services/admin-service";

const UserIdParams = z.object({ id: z.string().uuid() });
const GroupIdParams = z.object({ id: z.string().uuid() });
const MemberParams = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const adminRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/admin/users",
    {
      schema: {
        querystring: AdminUsersQuerySchema,
        response: { 200: AdminUsersListResponseSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return listAdminUsers({
        q: request.query.q,
        cursor: request.query.cursor,
      });
    },
  );

  app.post(
    "/admin/users",
    {
      schema: {
        body: CreateAdminUserBodySchema,
        response: { 201: CreateAdminUserResponseSchema },
      },
    },
    async (request, reply) => {
      const admin = await requireAdmin(app, request);
      const result = await createAdminUser(admin.id, request.body);
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/admin/users/:id/reset-password",
    {
      schema: {
        params: UserIdParams,
        body: ResetAdminPasswordBodySchema,
        response: { 200: ResetAdminPasswordResponseSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return resetAdminUserPassword(request.params.id, request.body.initialPassword);
    },
  );

  app.get(
    "/admin/groups",
    {
      schema: {
        querystring: AdminGroupsQuerySchema,
        response: { 200: AdminGroupsListResponseSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return listAdminGroups(request.query.q);
    },
  );

  app.post(
    "/admin/groups",
    {
      schema: {
        body: CreateAdminGroupBodySchema,
        response: { 200: AdminGroupSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return createAdminGroup(request.body);
    },
  );

  app.patch(
    "/admin/groups/:id",
    {
      schema: {
        params: GroupIdParams,
        body: UpdateAdminGroupBodySchema,
        response: { 200: AdminGroupSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return updateAdminGroup(request.params.id, request.body.name);
    },
  );

  app.put(
    "/admin/groups/:id/teacher",
    {
      schema: {
        params: GroupIdParams,
        body: SetAdminGroupTeacherBodySchema,
        response: { 200: AdminGroupSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return setAdminGroupTeacher(request.params.id, request.body);
    },
  );

  app.get(
    "/admin/groups/:id/members",
    {
      schema: {
        params: GroupIdParams,
        response: { 200: AdminMembersListResponseSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return listAdminMembers(request.params.id);
    },
  );

  app.post(
    "/admin/groups/:id/members",
    {
      schema: {
        params: GroupIdParams,
        body: AddAdminMemberBodySchema,
        response: { 200: AddAdminMemberResponseSchema },
      },
    },
    async (request) => {
      const admin = await requireAdmin(app, request);
      return addAdminMember(admin.id, request.params.id, request.body);
    },
  );

  app.patch(
    "/admin/groups/:id/members/:userId",
    {
      schema: {
        params: MemberParams,
        body: UpdateAdminMemberBodySchema,
        response: { 200: AdminMemberSchema },
      },
    },
    async (request) => {
      await requireAdmin(app, request);
      return updateAdminMember(request.params.id, request.params.userId, request.body);
    },
  );

  app.delete(
    "/admin/groups/:id/members/:userId",
    {
      schema: {
        params: MemberParams,
      },
    },
    async (request, reply) => {
      await requireAdmin(app, request);
      await removeAdminMember(request.params.id, request.params.userId);
      return reply.code(204).send();
    },
  );
};

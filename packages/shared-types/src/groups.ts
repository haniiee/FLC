import { z } from "zod";
import { GroupRoleSchema } from "./auth";

export const CreateGroupBodySchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateGroupBody = z.infer<typeof CreateGroupBodySchema>;

export const UpdateGroupBodySchema = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateGroupBody = z.infer<typeof UpdateGroupBodySchema>;

export const GroupSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  myRole: GroupRoleSchema,
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GroupSummary = z.infer<typeof GroupSummarySchema>;

export const GroupDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  myRole: GroupRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GroupDetail = z.infer<typeof GroupDetailSchema>;

export const GroupsListResponseSchema = z.object({
  groups: z.array(GroupSummarySchema),
});
export type GroupsListResponse = z.infer<typeof GroupsListResponseSchema>;

export const GroupMemberSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  role: GroupRoleSchema,
  joinedAt: z.string().datetime(),
  phone: z.string().optional(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupMembersResponseSchema = z.object({
  members: z.array(GroupMemberSchema),
});
export type GroupMembersResponse = z.infer<typeof GroupMembersResponseSchema>;

export const UpdateMemberRoleBodySchema = z.object({
  role: z.enum(["assistant", "student"]),
});
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBodySchema>;

export const CreateInviteBodySchema = z.object({
  expiresInHours: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBodySchema>;

export const InviteSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  url: z.string().url(),
  expiresAt: z.string().datetime().nullable(),
  maxUses: z.number().int().nullable(),
  uses: z.number().int(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Invite = z.infer<typeof InviteSchema>;

export const InvitesListResponseSchema = z.object({
  invites: z.array(InviteSchema),
});
export type InvitesListResponse = z.infer<typeof InvitesListResponseSchema>;

export const PublicInviteSchema = z.object({
  groupName: z.string(),
  teacherName: z.string(),
  valid: z.boolean(),
});
export type PublicInvite = z.infer<typeof PublicInviteSchema>;

export const JoinInviteResponseSchema = z.object({
  groupId: z.string().uuid(),
  role: GroupRoleSchema,
  alreadyMember: z.boolean(),
});
export type JoinInviteResponse = z.infer<typeof JoinInviteResponseSchema>;

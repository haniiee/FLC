import { z } from "zod";
import { GroupRoleSchema, PlatformRoleSchema, UserSchema } from "./auth";

export const AdminUsersQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  displayName: z.string(),
  platformRole: PlatformRoleSchema,
  mustChangePassword: z.boolean(),
  createdAt: z.string().datetime(),
  groupCount: z.number().int().nonnegative(),
  roles: z.array(GroupRoleSchema),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUsersListResponseSchema = z.object({
  items: z.array(AdminUserSchema),
  nextCursor: z.string().nullable(),
});
export type AdminUsersListResponse = z.infer<typeof AdminUsersListResponseSchema>;

export const CreateAdminUserBodySchema = z.object({
  phone: z.string().min(1),
  displayName: z.string().min(1).max(100),
  initialPassword: z.string().min(8).optional(),
});
export type CreateAdminUserBody = z.infer<typeof CreateAdminUserBodySchema>;

export const CreateAdminUserResponseSchema = z.object({
  user: UserSchema,
  initialPassword: z.string().min(8),
});
export type CreateAdminUserResponse = z.infer<typeof CreateAdminUserResponseSchema>;

export const ResetAdminPasswordBodySchema = z.object({
  initialPassword: z.string().min(8).optional(),
});
export type ResetAdminPasswordBody = z.infer<typeof ResetAdminPasswordBodySchema>;

export const ResetAdminPasswordResponseSchema = z.object({
  initialPassword: z.string().min(8),
});
export type ResetAdminPasswordResponse = z.infer<typeof ResetAdminPasswordResponseSchema>;

export const AdminGroupsQuerySchema = z.object({
  q: z.string().optional(),
});
export type AdminGroupsQuery = z.infer<typeof AdminGroupsQuerySchema>;

export const AdminGroupTeacherSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  displayName: z.string(),
});
export type AdminGroupTeacher = z.infer<typeof AdminGroupTeacherSchema>;

export const AdminGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  teacher: AdminGroupTeacherSchema,
  assistantCount: z.number().int().nonnegative(),
  studentCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminGroup = z.infer<typeof AdminGroupSchema>;

export const AdminGroupsListResponseSchema = z.object({
  items: z.array(AdminGroupSchema),
});
export type AdminGroupsListResponse = z.infer<typeof AdminGroupsListResponseSchema>;

export const CreateAdminGroupBodySchema = z.object({
  name: z.string().min(1).max(120),
  teacherUserId: z.string().uuid(),
});
export type CreateAdminGroupBody = z.infer<typeof CreateAdminGroupBodySchema>;

export const UpdateAdminGroupBodySchema = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateAdminGroupBody = z.infer<typeof UpdateAdminGroupBodySchema>;

export const SetAdminGroupTeacherBodySchema = z.object({
  userId: z.string().uuid(),
  previousTeacher: z.enum(["assistant", "remove"]),
});
export type SetAdminGroupTeacherBody = z.infer<typeof SetAdminGroupTeacherBodySchema>;

export const AdminMemberSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  displayName: z.string(),
  role: GroupRoleSchema,
  joinedAt: z.string().datetime(),
});
export type AdminMember = z.infer<typeof AdminMemberSchema>;

export const AdminMembersListResponseSchema = z.object({
  members: z.array(AdminMemberSchema),
});
export type AdminMembersListResponse = z.infer<typeof AdminMembersListResponseSchema>;

export const AdminNewUserBodySchema = z.object({
  phone: z.string().min(1),
  displayName: z.string().min(1).max(100),
  initialPassword: z.string().min(8).optional(),
});
export type AdminNewUserBody = z.infer<typeof AdminNewUserBodySchema>;

export const AddAdminMemberBodySchema = z.union([
  z.object({
    role: z.enum(["assistant", "student"]),
    userId: z.string().uuid(),
  }),
  z.object({
    role: z.enum(["assistant", "student"]),
    newUser: AdminNewUserBodySchema,
  }),
]);
export type AddAdminMemberBody = z.infer<typeof AddAdminMemberBodySchema>;

export const AddAdminMemberResponseSchema = z.object({
  member: AdminMemberSchema,
  existing: z.boolean().optional(),
  initialPassword: z.string().min(8).optional(),
});
export type AddAdminMemberResponse = z.infer<typeof AddAdminMemberResponseSchema>;

export const UpdateAdminMemberBodySchema = z.object({
  role: z.enum(["assistant", "student"]),
});
export type UpdateAdminMemberBody = z.infer<typeof UpdateAdminMemberBodySchema>;

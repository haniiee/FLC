import { z } from "zod";

export const PlatformRoleSchema = z.enum(["teacher", "user", "admin"]);
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

export const GroupRoleSchema = z.enum(["teacher", "assistant", "student"]);
export type GroupRole = z.infer<typeof GroupRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  displayName: z.string(),
  platformRole: PlatformRoleSchema,
  mustChangePassword: z.boolean(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RegisterBodySchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

export const LogoutBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutBody = z.infer<typeof LogoutBodySchema>;

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;

export const MeResponseSchema = z.object({
  user: UserSchema,
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type {
  AddAdminMemberBody,
  AddAdminMemberResponse,
  AdminGroup,
  AdminGroupsListResponse,
  AdminMember,
  AdminMembersListResponse,
  AdminUser,
  AdminUsersListResponse,
  CreateAdminGroupBody,
  CreateAdminUserBody,
  CreateAdminUserResponse,
  ResetAdminPasswordResponse,
  SetAdminGroupTeacherBody,
  UpdateAdminMemberBody,
} from "@app/shared-types";
import { db } from "../db";
import { groupMembers, groups, users, type User as DbUser } from "../db/schema";
import { ensureGroupChatChannels } from "../lib/chat-access";
import { badRequest, conflict, notFound } from "../lib/errors";
import { toUserDto } from "../lib/mappers";
import { generateInitialPassword, hashPassword } from "../lib/password";
import { normalizePhone } from "../lib/phone";
import { kickUserFromGroupChats } from "../realtime";
import { revokeAllUserRefreshTokens } from "./auth-service";

const PAGE_SIZE = 50;

function encodeUserCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

function decodeUserCursor(cursor: string): { createdAt: Date; id: string } | null {
  const separator = cursor.lastIndexOf("|");
  if (separator <= 0) return null;
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

async function loadAdminUser(userId: string): Promise<AdminUser> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
  }

  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
  });
  const roles = [...new Set(memberships.map((m) => m.role))];

  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    platformRole: user.platformRole,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    groupCount: memberships.length,
    roles,
  };
}

export async function listAdminUsers(input: {
  q?: string;
  cursor?: string;
}): Promise<AdminUsersListResponse> {
  const decoded = input.cursor ? decodeUserCursor(input.cursor) : null;
  const query = input.q?.trim();
  const pattern = query ? `%${query}%` : null;

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        pattern ? or(ilike(users.phone, pattern), ilike(users.displayName, pattern)) : undefined,
        decoded
          ? or(
              sql`${users.createdAt} < ${decoded.createdAt}`,
              and(eq(users.createdAt, decoded.createdAt), sql`${users.id} < ${decoded.id}`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const items = await Promise.all(page.map((row) => loadAdminUser(row.id)));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > PAGE_SIZE && last ? encodeUserCursor(last.createdAt, last.id) : null;

  return { items, nextCursor };
}

async function createUserRecord(input: {
  phone: string;
  displayName: string;
  initialPassword?: string;
  createdBy: string;
}): Promise<{ user: DbUser; initialPassword: string }> {
  const phone = normalizePhone(input.phone);
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });
  if (existing) {
    throw conflict("PHONE_TAKEN", "این شماره قبلاً ثبت شده است");
  }

  const initialPassword = input.initialPassword ?? generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);

  const [user] = await db
    .insert(users)
    .values({
      phone,
      displayName: input.displayName.trim(),
      passwordHash,
      platformRole: "user",
      mustChangePassword: true,
      createdBy: input.createdBy,
    })
    .returning();

  if (!user) {
    throw badRequest("USER_CREATE_FAILED", "ساخت کاربر ناموفق بود");
  }

  return { user, initialPassword };
}

export async function createAdminUser(
  adminId: string,
  input: CreateAdminUserBody,
): Promise<CreateAdminUserResponse> {
  const { user, initialPassword } = await createUserRecord({
    phone: input.phone,
    displayName: input.displayName,
    initialPassword: input.initialPassword,
    createdBy: adminId,
  });

  return {
    user: toUserDto(user),
    initialPassword,
  };
}

export async function resetAdminUserPassword(
  userId: string,
  initialPassword?: string,
): Promise<ResetAdminPasswordResponse> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
  }

  const password = initialPassword ?? generateInitialPassword();
  const passwordHash = await hashPassword(password);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
    })
    .where(eq(users.id, userId));

  await revokeAllUserRefreshTokens(userId);

  return { initialPassword: password };
}

async function toAdminGroup(groupId: string): Promise<AdminGroup> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { owner: true },
  });
  if (!group) {
    throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
  }

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
  });

  const teacherUser = group.owner;
  if (!teacherUser) {
    throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
  }

  return {
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    teacher: {
      id: teacherUser.id,
      phone: teacherUser.phone,
      displayName: teacherUser.displayName,
    },
    assistantCount: members.filter((m) => m.role === "assistant").length,
    studentCount: members.filter((m) => m.role === "student").length,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function listAdminGroups(q?: string): Promise<AdminGroupsListResponse> {
  const query = q?.trim();
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(query ? ilike(groups.name, `%${query}%`) : undefined)
    .orderBy(asc(groups.name));

  const items = await Promise.all(rows.map((row) => toAdminGroup(row.id)));
  return { items };
}

export async function createAdminGroup(input: CreateAdminGroupBody): Promise<AdminGroup> {
  const teacher = await db.query.users.findFirst({
    where: eq(users.id, input.teacherUserId),
  });
  if (!teacher) {
    throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
  }

  const now = new Date();
  const group = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(groups)
      .values({
        name: input.name.trim(),
        ownerId: teacher.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw badRequest("GROUP_CREATE_FAILED", "ساخت گروه ناموفق بود");
    }

    await tx.insert(groupMembers).values({
      groupId: created.id,
      userId: teacher.id,
      role: "teacher",
    });

    await ensureGroupChatChannels(created.id, tx);
    return created;
  });

  return toAdminGroup(group.id);
}

export async function updateAdminGroup(groupId: string, name: string): Promise<AdminGroup> {
  const [updated] = await db
    .update(groups)
    .set({
      name: name.trim(),
      updatedAt: new Date(),
    })
    .where(eq(groups.id, groupId))
    .returning();

  if (!updated) {
    throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
  }

  return toAdminGroup(updated.id);
}

export async function setAdminGroupTeacher(
  groupId: string,
  input: SetAdminGroupTeacherBody,
): Promise<AdminGroup> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) {
    throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
  }

  const newTeacher = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (!newTeacher) {
    throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
  }

  if (group.ownerId === newTeacher.id) {
    return toAdminGroup(groupId);
  }

  const previousTeacherId = group.ownerId;

  await db.transaction(async (tx) => {
    const existingMembership = await tx.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newTeacher.id)),
    });

    if (existingMembership) {
      await tx
        .update(groupMembers)
        .set({ role: "teacher" })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newTeacher.id)));
    } else {
      await tx.insert(groupMembers).values({
        groupId,
        userId: newTeacher.id,
        role: "teacher",
      });
    }

    if (input.previousTeacher === "assistant") {
      await tx
        .update(groupMembers)
        .set({ role: "assistant" })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, previousTeacherId)));
    } else {
      await tx
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, previousTeacherId)));
    }

    await tx
      .update(groups)
      .set({
        ownerId: newTeacher.id,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId));
  });

  if (input.previousTeacher === "remove") {
    await kickUserFromGroupChats(previousTeacherId, groupId);
  }

  return toAdminGroup(groupId);
}

function toAdminMember(member: {
  user: DbUser;
  role: "teacher" | "assistant" | "student";
  joinedAt: Date;
}): AdminMember {
  return {
    id: member.user.id,
    phone: member.user.phone,
    displayName: member.user.displayName,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}

export async function listAdminMembers(groupId: string): Promise<AdminMembersListResponse> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) {
    throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
  }

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: true },
  });

  return {
    members: members.map((member) => toAdminMember(member)),
  };
}

export async function addAdminMember(
  adminId: string,
  groupId: string,
  input: AddAdminMemberBody,
): Promise<AddAdminMemberResponse> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) {
    throw notFound("GROUP_NOT_FOUND", "گروه پیدا نشد");
  }

  let targetUser: DbUser;
  let initialPassword: string | undefined;
  let existing = false;

  if ("userId" in input) {
    const found = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });
    if (!found) {
      throw notFound("USER_NOT_FOUND", "کاربر پیدا نشد");
    }
    targetUser = found;
  } else {
    const phone = normalizePhone(input.newUser.phone);
    const found = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });
    if (found) {
      targetUser = found;
      existing = true;
    } else {
      const created = await createUserRecord({
        phone: input.newUser.phone,
        displayName: input.newUser.displayName,
        initialPassword: input.newUser.initialPassword,
        createdBy: adminId,
      });
      targetUser = created.user;
      initialPassword = created.initialPassword;
    }
  }

  const already = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUser.id)),
  });
  if (already) {
    throw conflict("ALREADY_MEMBER", "این کاربر قبلاً عضو گروه است");
  }

  const [member] = await db
    .insert(groupMembers)
    .values({
      groupId,
      userId: targetUser.id,
      role: input.role,
    })
    .returning();

  if (!member) {
    throw badRequest("MEMBER_ADD_FAILED", "افزودن عضو ناموفق بود");
  }

  return {
    member: toAdminMember({ user: targetUser, role: member.role, joinedAt: member.joinedAt }),
    ...(existing ? { existing: true } : {}),
    ...(initialPassword ? { initialPassword } : {}),
  };
}

export async function updateAdminMember(
  groupId: string,
  userId: string,
  input: UpdateAdminMemberBody,
): Promise<AdminMember> {
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    with: { user: true },
  });
  if (!membership) {
    throw notFound("MEMBER_NOT_FOUND", "عضو پیدا نشد");
  }
  if (membership.role === "teacher") {
    throw badRequest("USE_TEACHER_ENDPOINT", "برای تغییر معلم از endpoint معلم استفاده کنید");
  }

  const [updated] = await db
    .update(groupMembers)
    .set({ role: input.role })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning();

  if (!updated) {
    throw notFound("MEMBER_NOT_FOUND", "عضو پیدا نشد");
  }

  return toAdminMember({
    user: membership.user,
    role: updated.role,
    joinedAt: updated.joinedAt,
  });
}

export async function removeAdminMember(groupId: string, userId: string): Promise<void> {
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });
  if (!membership) {
    throw notFound("MEMBER_NOT_FOUND", "عضو پیدا نشد");
  }
  if (membership.role === "teacher") {
    throw badRequest("CANNOT_REMOVE_TEACHER", "معلم گروه را نمی‌توان حذف کرد");
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

  await kickUserFromGroupChats(userId, groupId);
}

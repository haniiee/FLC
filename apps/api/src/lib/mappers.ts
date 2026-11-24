import type { User as DbUser, GroupInvite as DbInvite } from "../db/schema";
import type { GroupRole, Invite, User } from "@app/shared-types";
import { env } from "../env";

export function toUserDto(user: DbUser): User {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    platformRole: user.platformRole,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toInviteDto(invite: DbInvite): Invite {
  return {
    id: invite.id,
    code: invite.code,
    url: `${env.WEB_URL}/join/${invite.code}`,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    maxUses: invite.maxUses,
    uses: invite.uses,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
  };
}

export function isInviteValid(invite: {
  expiresAt: Date | null;
  maxUses: number | null;
  uses: number;
  revokedAt: Date | null;
}): boolean {
  if (invite.revokedAt) {
    return false;
  }
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    return false;
  }
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    return false;
  }
  return true;
}

export type MembershipRole = GroupRole;

import type { GroupRole } from "@app/shared-types";

export function canManageContent(role: GroupRole | undefined): boolean {
  return role === "teacher" || role === "assistant";
}

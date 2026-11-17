import { ApiClientError } from "@app/api-client";
import type { GroupRole } from "@app/shared-types";
import { copy } from "./copy";

export function roleLabel(role: GroupRole): string {
  switch (role) {
    case "teacher":
      return copy.classes.roleTeacher;
    case "assistant":
      return copy.classes.roleAssistant;
    case "student":
      return copy.classes.roleStudent;
  }
}

export function apiErrorMessage(error: unknown, fallback: string = copy.errors.generic): string {
  if (error instanceof ApiClientError) {
    return copy.errors[error.code as keyof typeof copy.errors] ?? error.message ?? fallback;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || displayName;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

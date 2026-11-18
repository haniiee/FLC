import { ApiClientError } from "@app/api-client";
import type { FileKind, GroupRole } from "@app/shared-types";
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

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) {
    return "";
  }
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case "audio":
      return copy.content.kindAudio;
    case "pdf":
      return copy.content.kindPdf;
    case "image":
      return copy.content.kindImage;
    case "video":
      return copy.content.kindVideo;
    case "text":
      return copy.content.kindText;
  }
}

export function fileExtensionForKind(kind: FileKind, mimeType?: string | null): string {
  if (mimeType?.includes("png")) return ".png";
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) return ".jpg";
  if (mimeType?.includes("webp")) return ".webp";
  if (mimeType?.includes("pdf")) return ".pdf";
  if (mimeType?.includes("mp4")) return ".mp4";
  if (mimeType?.includes("mpeg") || mimeType?.includes("mp3")) return ".mp3";
  if (mimeType?.includes("m4a") || mimeType?.includes("mp4a")) return ".m4a";
  switch (kind) {
    case "audio":
      return ".m4a";
    case "pdf":
      return ".pdf";
    case "image":
      return ".jpg";
    case "video":
      return ".mp4";
    case "text":
      return ".txt";
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

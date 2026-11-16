import type { FileKind, GroupRole } from "@app/shared-types";

export function roleLabel(role: GroupRole): string {
  switch (role) {
    case "teacher":
      return "استاد";
    case "assistant":
      return "دستیار";
    case "student":
      return "شاگرد";
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
      return "صوت";
    case "pdf":
      return "PDF";
    case "image":
      return "تصویر";
    case "video":
      return "ویدیو";
    case "text":
      return "متن";
  }
}

export function apiErrorMessage(error: unknown, fallback = "خطایی رخ داد"): string {
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

export const FILE_ACCEPT =
  "audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/webm,audio/ogg,audio/wav,application/pdf,image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm";

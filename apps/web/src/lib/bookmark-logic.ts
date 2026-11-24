import type { FileKind } from "@app/shared-types";

export type BookmarkKindFilter = "all" | FileKind;

export const bookmarksQueryKey = ["bookmarks"] as const;

export function bookmarksForFileQueryKey(fileId: string) {
  return ["bookmarks", { fileId }] as const;
}

export function formatBookmarkClock(positionMs: number): string {
  const safe = Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0;
  const totalSec = Math.round(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatBookmarkAt(positionMs: number): string {
  return `at ${formatBookmarkClock(positionMs)}`;
}

export function filterBookmarksByKind<T extends { kind: FileKind }>(
  items: readonly T[],
  filter: BookmarkKindFilter,
): T[] {
  if (filter === "all") return items.slice();
  return items.filter((item) => item.kind === filter);
}

export function fileLevelBookmark<T extends { fileId: string; positionMs: number | null }>(
  items: readonly T[],
  fileId: string,
): T | null {
  return items.find((item) => item.fileId === fileId && item.positionMs == null) ?? null;
}

export function isFileBookmarked(
  items: readonly { fileId: string; positionMs: number | null }[],
  fileId: string,
): boolean {
  return fileLevelBookmark(items, fileId) != null;
}

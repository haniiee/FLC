import type { FileKind } from "@app/shared-types";

export type BookmarkFilter = "all" | "voices" | "files";

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

/** "at 0:42" */
export function formatBookmarkAt(positionMs: number): string {
  return `at ${formatBookmarkClock(positionMs)}`;
}

export function filterBookmarks<T extends { kind: FileKind }>(
  items: readonly T[],
  filter: BookmarkFilter,
): T[] {
  if (filter === "voices") return items.filter((item) => item.kind === "audio");
  if (filter === "files") return items.filter((item) => item.kind !== "audio");
  return items.slice();
}

/** The file-level bookmark is the one without a playback position. */
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

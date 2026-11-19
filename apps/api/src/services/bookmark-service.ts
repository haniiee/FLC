import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  fileDisplayName,
  sessionDisplayName,
  topicDisplayName,
  type Bookmark,
  type BookmarksQuery,
  type FileKind,
} from "@app/shared-types";
import { db } from "../db";
import { bookmarks, files, groupMembers, groups, sessions, topics } from "../db/schema";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { getMembership } from "../lib/group-access";
import { createPlaylistFileUrl } from "../storage";

type BookmarkRow = {
  id: string;
  fileId: string;
  positionMs: number | null;
  note: string | null;
  createdAt: Date;
  file: typeof files.$inferSelect;
  groupName: string;
  sessionNumber: number;
  sessionTitle: string | null;
  topicNumber: number | null;
  topicTitle: string | null;
};

function normalizeNote(note: string | null | undefined): string | null {
  if (note == null) return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUniqueViolation(error: unknown): boolean {
  const current = error as { code?: string; cause?: { code?: string } };
  return current.code === "23505" || current.cause?.code === "23505";
}

function roundPosition(positionMs: number, durationMs: number): number {
  const rounded = Math.round(positionMs / 1000) * 1000;
  return Math.min(durationMs, Math.max(0, rounded));
}

async function findByKey(userId: string, fileId: string, positionMs: number | null) {
  return db.query.bookmarks.findFirst({
    where: and(
      eq(bookmarks.userId, userId),
      eq(bookmarks.fileId, fileId),
      positionMs == null ? isNull(bookmarks.positionMs) : eq(bookmarks.positionMs, positionMs),
    ),
  });
}

async function selectRows(userId: string, bookmarkId?: string, filter?: BookmarksQuery) {
  const conditions = [eq(bookmarks.userId, userId)];
  if (bookmarkId) conditions.push(eq(bookmarks.id, bookmarkId));
  if (filter?.fileId) conditions.push(eq(bookmarks.fileId, filter.fileId));
  if (filter?.kind) conditions.push(eq(files.kind, filter.kind));

  return db
    .select({
      id: bookmarks.id,
      fileId: bookmarks.fileId,
      positionMs: bookmarks.positionMs,
      note: bookmarks.note,
      createdAt: bookmarks.createdAt,
      file: files,
      groupName: groups.name,
      sessionNumber: sessions.number,
      sessionTitle: sessions.title,
      topicNumber: topics.number,
      topicTitle: topics.title,
    })
    .from(bookmarks)
    .innerJoin(files, eq(files.id, bookmarks.fileId))
    .innerJoin(groups, eq(groups.id, files.groupId))
    .innerJoin(sessions, eq(sessions.id, files.sessionId))
    .leftJoin(topics, eq(topics.id, files.topicId))
    .where(and(...conditions))
    .orderBy(desc(bookmarks.createdAt));
}

async function toDtos(userId: string, rows: BookmarkRow[]): Promise<Bookmark[]> {
  const groupIds = [...new Set(rows.map((row) => row.file.groupId))];
  const memberships =
    groupIds.length === 0
      ? []
      : await db
          .select({ groupId: groupMembers.groupId })
          .from(groupMembers)
          .where(and(eq(groupMembers.userId, userId), inArray(groupMembers.groupId, groupIds)));
  const memberGroups = new Set(memberships.map((row) => row.groupId));

  const items: Bookmark[] = [];
  for (const row of rows) {
    const available = memberGroups.has(row.file.groupId) && Boolean(row.file.storageKey);
    const item: Bookmark = {
      id: row.id,
      fileId: row.fileId,
      kind: row.file.kind,
      positionMs: row.positionMs,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      available,
      file: {
        displayName: fileDisplayName(row.file) ?? "File",
        durationMs: row.file.durationMs,
        mimeType: row.file.mimeType,
        groupId: row.file.groupId,
        groupDisplayName: row.groupName,
        sessionId: row.file.sessionId,
        sessionDisplayName: sessionDisplayName({
          number: row.sessionNumber,
          title: row.sessionTitle,
        }),
        topicId: row.file.topicId,
        topicDisplayName:
          row.topicNumber == null
            ? null
            : topicDisplayName({ number: row.topicNumber, title: row.topicTitle }),
      },
    };
    if (available && row.file.storageKey) {
      item.url = await createPlaylistFileUrl(row.file.storageKey);
    }
    items.push(item);
  }
  return items;
}

async function requireDto(userId: string, bookmarkId: string): Promise<Bookmark> {
  const rows = await selectRows(userId, bookmarkId);
  const [item] = await toDtos(userId, rows);
  if (!item) {
    throw notFound("BOOKMARK_NOT_FOUND", "نشانک پیدا نشد");
  }
  return item;
}

async function resolvePosition(
  file: { kind: FileKind; durationMs: number | null },
  positionMs: number | undefined,
): Promise<number | null> {
  if (positionMs == null) return null;
  if (file.kind !== "audio") {
    throw badRequest("POSITION_NOT_ALLOWED", "زمان فقط برای فایل صوتی مجاز است");
  }
  if (file.durationMs == null || positionMs > file.durationMs) {
    throw badRequest("POSITION_OUT_OF_RANGE", "زمان خارج از طول فایل است");
  }
  return roundPosition(positionMs, file.durationMs);
}

export async function listBookmarks(userId: string, filter: BookmarksQuery = {}) {
  const rows = await selectRows(userId, undefined, filter);
  return { items: await toDtos(userId, rows) };
}

export async function createBookmark(
  userId: string,
  input: { fileId: string; positionMs?: number; note?: string | null },
): Promise<{ bookmark: Bookmark; created: boolean }> {
  const file = await db.query.files.findFirst({ where: eq(files.id, input.fileId) });
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  const positionMs = await resolvePosition(file, input.positionMs);
  if (!(await getMembership(file.groupId, userId))) {
    throw forbidden("GROUP_FORBIDDEN", "دسترسی به این گروه مجاز نیست");
  }

  const existing = await findByKey(userId, file.id, positionMs);
  if (existing) {
    if (input.note !== undefined) {
      await db
        .update(bookmarks)
        .set({ note: normalizeNote(input.note), updatedAt: new Date() })
        .where(eq(bookmarks.id, existing.id));
    }
    return { bookmark: await requireDto(userId, existing.id), created: false };
  }

  try {
    const [created] = await db
      .insert(bookmarks)
      .values({
        userId,
        fileId: file.id,
        positionMs,
        note: input.note === undefined ? null : normalizeNote(input.note),
      })
      .returning();
    return { bookmark: await requireDto(userId, created!.id), created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const again = await findByKey(userId, file.id, positionMs);
    if (!again) throw error;
    if (input.note !== undefined) {
      await db
        .update(bookmarks)
        .set({ note: normalizeNote(input.note), updatedAt: new Date() })
        .where(eq(bookmarks.id, again.id));
    }
    return { bookmark: await requireDto(userId, again.id), created: false };
  }
}

export async function updateBookmarkNote(userId: string, bookmarkId: string, note: string | null) {
  const owned = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)),
  });
  if (!owned) {
    throw notFound("BOOKMARK_NOT_FOUND", "نشانک پیدا نشد");
  }
  await db
    .update(bookmarks)
    .set({ note: normalizeNote(note), updatedAt: new Date() })
    .where(eq(bookmarks.id, bookmarkId));
  return requireDto(userId, bookmarkId);
}

export async function deleteBookmark(userId: string, bookmarkId: string) {
  const owned = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)),
  });
  if (!owned) {
    throw notFound("BOOKMARK_NOT_FOUND", "نشانک پیدا نشد");
  }
  await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));
}

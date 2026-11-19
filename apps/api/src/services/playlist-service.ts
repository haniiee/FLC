import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  fileDisplayName,
  playlistDisplayName,
  sessionDisplayName,
  topicDisplayName,
  type PlaylistDetail,
  type PlaylistSummary,
  type PlaylistTrack,
} from "@app/shared-types";
import { db } from "../db";
import {
  files,
  groupMembers,
  groups,
  playlistItems,
  playlists,
  sessions,
  topics,
  type FileRow,
} from "../db/schema";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { getMembership } from "../lib/group-access";
import { nextPlaylistNumber } from "../lib/numbering";
import { createPlaylistFileUrl } from "../storage";

const MAX_ITEMS = 500;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function normalizeTitle(title: string | null | undefined): string | null {
  if (title == null) return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireOwned(ownerId: string, playlistId: string) {
  const playlist = await db.query.playlists.findFirst({
    where: and(eq(playlists.id, playlistId), eq(playlists.ownerId, ownerId)),
  });
  if (!playlist) {
    throw notFound("PLAYLIST_NOT_FOUND", "پلی‌لیست پیدا نشد");
  }
  return playlist;
}

async function resolvePlayableFiles(userId: string, fileIds: string[]) {
  const ids = [...new Set(fileIds)];
  const rows = ids.length === 0 ? [] : await db.select().from(files).where(inArray(files.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const membership = new Map<string, boolean>();
  const ordered: FileRow[] = [];

  for (const id of fileIds) {
    if (ordered.some((file) => file.id === id)) continue;
    const file = byId.get(id);
    if (!file || file.kind !== "audio" || file.status !== "ready" || !file.storageKey) {
      throw badRequest("FILE_NOT_PLAYABLE", "فایل قابل پخش نیست");
    }
    let isMember = membership.get(file.groupId);
    if (isMember === undefined) {
      isMember = Boolean(await getMembership(file.groupId, userId));
      membership.set(file.groupId, isMember);
    }
    if (!isMember) {
      throw forbidden("GROUP_FORBIDDEN", "دسترسی به این گروه مجاز نیست");
    }
    ordered.push(file);
  }

  return ordered;
}

function toSummary(
  playlist: { id: string; number: number; title: string | null; updatedAt: Date },
  itemCount: number,
  totalDurationMs: number,
): PlaylistSummary {
  return {
    id: playlist.id,
    number: playlist.number,
    title: playlist.title,
    displayName: playlistDisplayName(playlist),
    itemCount,
    totalDurationMs,
    updatedAt: playlist.updatedAt.toISOString(),
  };
}

async function loadTracks(ownerId: string, playlistId: string): Promise<PlaylistTrack[]> {
  const rows = await db
    .select({
      file: files,
      groupName: groups.name,
      sessionNumber: sessions.number,
      sessionTitle: sessions.title,
      topicNumber: topics.number,
      topicTitle: topics.title,
    })
    .from(playlistItems)
    .innerJoin(files, eq(files.id, playlistItems.fileId))
    .innerJoin(groups, eq(groups.id, files.groupId))
    .innerJoin(sessions, eq(sessions.id, files.sessionId))
    .leftJoin(topics, eq(topics.id, files.topicId))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(asc(playlistItems.position));

  const groupIds = [...new Set(rows.map((row) => row.file.groupId))];
  const memberships =
    groupIds.length === 0
      ? []
      : await db
          .select({ groupId: groupMembers.groupId })
          .from(groupMembers)
          .where(and(eq(groupMembers.userId, ownerId), inArray(groupMembers.groupId, groupIds)));
  const memberGroups = new Set(memberships.map((row) => row.groupId));

  const tracks: PlaylistTrack[] = [];
  for (const row of rows) {
    const available =
      memberGroups.has(row.file.groupId) &&
      row.file.kind === "audio" &&
      row.file.status === "ready" &&
      Boolean(row.file.storageKey);
    const track: PlaylistTrack = {
      fileId: row.file.id,
      displayName: fileDisplayName(row.file) ?? "Voice",
      durationMs: row.file.durationMs,
      groupId: row.file.groupId,
      groupDisplayName: row.groupName,
      sessionDisplayName: sessionDisplayName({
        number: row.sessionNumber,
        title: row.sessionTitle,
      }),
      available,
    };
    if (row.topicNumber != null) {
      track.topicDisplayName = topicDisplayName({
        number: row.topicNumber,
        title: row.topicTitle,
      });
    }
    if (available && row.file.storageKey) {
      track.url = await createPlaylistFileUrl(row.file.storageKey);
    }
    tracks.push(track);
  }
  return tracks;
}

async function loadDetail(ownerId: string, playlistId: string): Promise<PlaylistDetail> {
  const playlist = await requireOwned(ownerId, playlistId);
  const items = await loadTracks(ownerId, playlist.id);
  const totalDurationMs = items.reduce((sum, item) => sum + (item.durationMs ?? 0), 0);
  return { ...toSummary(playlist, items.length, totalDurationMs), items };
}

async function touch(tx: Tx, playlistId: string) {
  await tx.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlistId));
}

export async function listPlaylists(ownerId: string) {
  const rows = await db
    .select({
      id: playlists.id,
      number: playlists.number,
      title: playlists.title,
      updatedAt: playlists.updatedAt,
      itemCount: count(playlistItems.id),
      totalDurationMs: sql<number>`coalesce(sum(${files.durationMs}), 0)::int`,
    })
    .from(playlists)
    .leftJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
    .leftJoin(files, eq(files.id, playlistItems.fileId))
    .where(eq(playlists.ownerId, ownerId))
    .groupBy(playlists.id)
    .orderBy(desc(playlists.updatedAt));

  return {
    items: rows.map((row) => toSummary(row, Number(row.itemCount), Number(row.totalDurationMs))),
  };
}

export async function createPlaylist(
  ownerId: string,
  input: { title?: string; fileIds?: string[] },
) {
  const accepted = await resolvePlayableFiles(ownerId, input.fileIds ?? []);
  if (accepted.length > MAX_ITEMS) {
    throw badRequest("PLAYLIST_FULL", "هر پلی‌لیست حداکثر ۵۰۰ فایل دارد");
  }

  const playlistId = await db.transaction(async (tx) => {
    const number = await nextPlaylistNumber(tx, ownerId);
    const [created] = await tx
      .insert(playlists)
      .values({
        ownerId,
        number,
        title: normalizeTitle(input.title),
      })
      .returning();
    if (!created) {
      throw notFound("PLAYLIST_NOT_FOUND", "پلی‌لیست پیدا نشد");
    }
    if (accepted.length > 0) {
      await tx.insert(playlistItems).values(
        accepted.map((file, position) => ({
          playlistId: created.id,
          fileId: file.id,
          position,
        })),
      );
    }
    return created.id;
  });

  return loadDetail(ownerId, playlistId);
}

export async function getPlaylistDetail(ownerId: string, playlistId: string) {
  return loadDetail(ownerId, playlistId);
}

export async function updatePlaylistTitle(
  ownerId: string,
  playlistId: string,
  title: string | null,
) {
  await requireOwned(ownerId, playlistId);
  await db
    .update(playlists)
    .set({ title: normalizeTitle(title), updatedAt: new Date() })
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, ownerId)));
  return loadDetail(ownerId, playlistId);
}

export async function deletePlaylist(ownerId: string, playlistId: string) {
  const deleted = await db
    .delete(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, ownerId)))
    .returning({ id: playlists.id });
  if (deleted.length === 0) {
    throw notFound("PLAYLIST_NOT_FOUND", "پلی‌لیست پیدا نشد");
  }
}

export async function addPlaylistItems(ownerId: string, playlistId: string, fileIds: string[]) {
  await requireOwned(ownerId, playlistId);
  const accepted = await resolvePlayableFiles(ownerId, fileIds);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from playlists where id = ${playlistId} for update`);
    const existing = await tx
      .select({ fileId: playlistItems.fileId, position: playlistItems.position })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId));
    const have = new Set(existing.map((row) => row.fileId));
    const fresh = accepted.filter((file) => !have.has(file.id));
    if (existing.length + fresh.length > MAX_ITEMS) {
      throw badRequest("PLAYLIST_FULL", "هر پلی‌لیست حداکثر ۵۰۰ فایل دارد");
    }
    if (fresh.length === 0) return;
    const maxPosition = existing.reduce((max, row) => Math.max(max, row.position), -1);
    await tx.insert(playlistItems).values(
      fresh.map((file, index) => ({
        playlistId,
        fileId: file.id,
        position: maxPosition + 1 + index,
      })),
    );
    await touch(tx, playlistId);
  });

  return loadDetail(ownerId, playlistId);
}

export async function removePlaylistItem(ownerId: string, playlistId: string, fileId: string) {
  await requireOwned(ownerId, playlistId);
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(playlistItems)
      .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.fileId, fileId)))
      .returning({ id: playlistItems.id });
    if (deleted.length > 0) {
      await touch(tx, playlistId);
    }
  });
  return loadDetail(ownerId, playlistId);
}

export async function reorderPlaylist(ownerId: string, playlistId: string, fileIds: string[]) {
  await requireOwned(ownerId, playlistId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from playlists where id = ${playlistId} for update`);
    const existing = await tx
      .select({ fileId: playlistItems.fileId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId));
    const current = new Set(existing.map((row) => row.fileId));
    const next = new Set(fileIds);
    const same =
      fileIds.length === existing.length &&
      next.size === fileIds.length &&
      [...next].every((id) => current.has(id));
    if (!same) {
      throw badRequest("PLAYLIST_ORDER_MISMATCH", "ترتیب با آیتم‌های فعلی پلی‌لیست یکی نیست");
    }
    for (let position = 0; position < fileIds.length; position += 1) {
      await tx
        .update(playlistItems)
        .set({ position })
        .where(
          and(
            eq(playlistItems.playlistId, playlistId),
            eq(playlistItems.fileId, fileIds[position]!),
          ),
        );
    }
    await touch(tx, playlistId);
  });
  return loadDetail(ownerId, playlistId);
}

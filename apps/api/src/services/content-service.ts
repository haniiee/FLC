import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { GroupRole } from "@app/shared-types";
import { db } from "../db";
import { files, sessions, topics, type FileRow } from "../db/schema";
import { toFileDto, toSessionSummary, toTopicSummary, visibleFiles } from "../lib/content-mappers";
import { fileDisplayName, topicDisplayName } from "../lib/display-name";
import { AppError, badRequest, notFound } from "../lib/errors";
import { nextFileNumber, nextSessionNumber, nextTopicNumber } from "../lib/numbering";
import { scheduleProcessAudio } from "../media/process-audio";
import {
  assertSizeAllowed,
  baseMime,
  buildStorageKey,
  createDownloadUrl,
  createUploadUrl,
  deleteStorageKeys,
  extensionForMime,
  headObject,
  mimeToKind,
} from "../storage";

function canManage(role: GroupRole) {
  return role === "teacher" || role === "assistant";
}

function canSeeIncomplete(role: GroupRole) {
  return canManage(role);
}

async function countTopics(sessionId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(topics)
    .where(eq(topics.sessionId, sessionId));
  return Number(row?.value ?? 0);
}

async function countSessionFiles(sessionId: string, includeIncomplete: boolean) {
  const conditions = [eq(files.sessionId, sessionId)];
  if (!includeIncomplete) {
    conditions.push(eq(files.status, "ready"));
  }
  const [row] = await db
    .select({ value: count() })
    .from(files)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

async function countTopicFiles(topicId: string, includeIncomplete: boolean) {
  const conditions = [eq(files.topicId, topicId)];
  if (!includeIncomplete) {
    conditions.push(eq(files.status, "ready"));
  }
  const [row] = await db
    .select({ value: count() })
    .from(files)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

export async function listSessions(groupId: string, role: GroupRole) {
  const rows = await db.query.sessions.findMany({
    where: eq(sessions.groupId, groupId),
    orderBy: [asc(sessions.number)],
  });
  const includeIncomplete = canSeeIncomplete(role);

  return Promise.all(
    rows.map(async (session) =>
      toSessionSummary(session, {
        topicCount: await countTopics(session.id),
        fileCount: await countSessionFiles(session.id, includeIncomplete),
      }),
    ),
  );
}

export async function createSession(groupId: string, userId: string, title?: string) {
  return db.transaction(async (tx) => {
    const number = await nextSessionNumber(tx, groupId);
    const [session] = await tx
      .insert(sessions)
      .values({
        groupId,
        number,
        title: title?.trim() || null,
        createdBy: userId,
      })
      .returning();
    if (!session) {
      throw badRequest("SESSION_CREATE_FAILED", "ساخت جلسه ناموفق بود");
    }
    return toSessionSummary(session, { topicCount: 0, fileCount: 0 });
  });
}

export async function getSessionDetail(sessionId: string, role: GroupRole) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!session) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }

  const includeIncomplete = canSeeIncomplete(role);
  const topicRows = await db.query.topics.findMany({
    where: eq(topics.sessionId, sessionId),
    orderBy: [asc(topics.number)],
  });

  const directFiles = visibleFiles(
    await db.query.files.findMany({
      where: and(eq(files.sessionId, sessionId), isNull(files.topicId)),
      orderBy: [asc(files.kind), asc(files.number)],
    }),
    includeIncomplete,
  );

  const topicSummaries = await Promise.all(
    topicRows.map(async (topic) =>
      toTopicSummary(topic, await countTopicFiles(topic.id, includeIncomplete)),
    ),
  );

  return {
    session: {
      id: session.id,
      groupId: session.groupId,
      number: session.number,
      title: session.title,
      displayName: toSessionSummary(session, { topicCount: 0, fileCount: 0 }).displayName,
      createdBy: session.createdBy,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    topics: topicSummaries,
    files: directFiles.map((file) => toFileDto(file)),
  };
}

export async function updateSessionTitle(sessionId: string, title: string | null) {
  const [session] = await db
    .update(sessions)
    .set({ title: title === null ? null : title.trim(), updatedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();
  if (!session) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }
  return toSessionSummary(session, {
    topicCount: await countTopics(session.id),
    fileCount: await countSessionFiles(session.id, true),
  });
}

export async function deleteSession(sessionId: string) {
  const fileRows = await db.query.files.findMany({
    where: eq(files.sessionId, sessionId),
  });
  const keys = fileRows.map((file) => file.storageKey).filter((key): key is string => !!key);

  const deleted = await db.delete(sessions).where(eq(sessions.id, sessionId)).returning({
    id: sessions.id,
  });
  if (deleted.length === 0) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }

  await deleteStorageKeys(keys);
}

export async function createTopic(sessionId: string, userId: string, title?: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }

  return db.transaction(async (tx) => {
    const number = await nextTopicNumber(tx, sessionId);
    const [topic] = await tx
      .insert(topics)
      .values({
        sessionId,
        number,
        title: title?.trim() || null,
        createdBy: userId,
      })
      .returning();
    if (!topic) {
      throw badRequest("TOPIC_CREATE_FAILED", "ساخت تاپیک ناموفق بود");
    }
    return toTopicSummary(topic, 0);
  });
}

export async function getTopicDetail(topicId: string, role: GroupRole) {
  const topic = await db.query.topics.findFirst({ where: eq(topics.id, topicId) });
  if (!topic) {
    throw notFound("TOPIC_NOT_FOUND", "تاپیک پیدا نشد");
  }

  const includeIncomplete = canSeeIncomplete(role);
  const topicFiles = visibleFiles(
    await db.query.files.findMany({
      where: eq(files.topicId, topicId),
      orderBy: [asc(files.kind), asc(files.number)],
    }),
    includeIncomplete,
  );

  return {
    topic: {
      id: topic.id,
      sessionId: topic.sessionId,
      number: topic.number,
      title: topic.title,
      displayName: topicDisplayName(topic),
      createdBy: topic.createdBy,
      createdAt: topic.createdAt.toISOString(),
      updatedAt: topic.updatedAt.toISOString(),
    },
    files: topicFiles.map((file) => toFileDto(file, { includeText: file.kind === "text" })),
  };
}

export async function updateTopicTitle(topicId: string, title: string | null) {
  const [topic] = await db
    .update(topics)
    .set({ title: title === null ? null : title.trim(), updatedAt: new Date() })
    .where(eq(topics.id, topicId))
    .returning();
  if (!topic) {
    throw notFound("TOPIC_NOT_FOUND", "تاپیک پیدا نشد");
  }
  return toTopicSummary(topic, await countTopicFiles(topic.id, true));
}

export async function deleteTopic(topicId: string) {
  const fileRows = await db.query.files.findMany({ where: eq(files.topicId, topicId) });
  const keys = fileRows.map((file) => file.storageKey).filter((key): key is string => !!key);

  const deleted = await db.delete(topics).where(eq(topics.id, topicId)).returning({
    id: topics.id,
  });
  if (deleted.length === 0) {
    throw notFound("TOPIC_NOT_FOUND", "تاپیک پیدا نشد");
  }

  await deleteStorageKeys(keys);
}

async function resolveSessionAndTopic(sessionId: string, topicId?: string | null) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }

  if (!topicId) {
    return { session, topic: null as null };
  }

  const topic = await db.query.topics.findFirst({
    where: and(eq(topics.id, topicId), eq(topics.sessionId, sessionId)),
  });
  if (!topic) {
    throw notFound("TOPIC_NOT_FOUND", "تاپیک پیدا نشد");
  }
  return { session, topic };
}

export async function createUploadUrlForFile(input: {
  userId: string;
  sessionId: string;
  topicId?: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  source?: "upload" | "recording";
}) {
  const source = input.source ?? "upload";
  const kind = mimeToKind(input.mimeType, source);
  assertSizeAllowed(kind, input.sizeBytes);
  const { session, topic } = await resolveSessionAndTopic(input.sessionId, input.topicId);
  const storedMime = baseMime(input.mimeType);

  const file = await db.transaction(async (tx) => {
    const number = await nextFileNumber(tx, {
      sessionId: session.id,
      topicId: topic?.id ?? null,
      kind,
    });

    const [created] = await tx
      .insert(files)
      .values({
        groupId: session.groupId,
        sessionId: session.id,
        topicId: topic?.id ?? null,
        kind,
        number,
        title: null,
        storageKey: null,
        mimeType: storedMime,
        sizeBytes: input.sizeBytes,
        status: "pending",
        source,
        uploadedBy: input.userId,
      })
      .returning();

    if (!created) {
      throw badRequest("FILE_CREATE_FAILED", "ساخت فایل ناموفق بود");
    }

    const ext = extensionForMime(storedMime, kind);
    const storageKey = buildStorageKey(session.groupId, created.id, ext);

    const [updated] = await tx
      .update(files)
      .set({ storageKey, updatedAt: new Date() })
      .where(eq(files.id, created.id))
      .returning();

    return updated ?? created;
  });

  const uploadUrl = await createUploadUrl(file.storageKey!, file.mimeType, 900);
  return {
    file: toFileDto(file),
    uploadUrl,
    expiresIn: 900 as const,
  };
}

export type CompleteFileResult = {
  file: ReturnType<typeof toFileDto>;
  httpStatus: 200 | 202;
};

export async function completeFileUpload(fileId: string): Promise<CompleteFileResult> {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  if (!file.storageKey) {
    throw badRequest("FILE_NO_STORAGE", "فایل ذخیره‌سازی ندارد");
  }

  try {
    const head = await headObject(file.storageKey);
    const remoteSize = head.ContentLength ?? 0;
    const expected = file.sizeBytes;
    const tolerance = Math.max(32, Math.floor(expected * 0.01));
    if (Math.abs(remoteSize - expected) > tolerance) {
      await db
        .update(files)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(files.id, fileId));
      throw badRequest("FILE_SIZE_MISMATCH", "حجم فایل آپلودشده با مقدار اعلامی مطابقت ندارد");
    }

    if (file.kind === "audio") {
      const [processing] = await db
        .update(files)
        .set({
          status: "processing",
          processingError: null,
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId))
        .returning();

      if (!processing) {
        throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
      }

      scheduleProcessAudio(fileId);
      return { file: toFileDto(processing), httpStatus: 202 };
    }

    const [ready] = await db
      .update(files)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId))
      .returning();

    if (!ready) {
      throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
    }
    return { file: toFileDto(ready), httpStatus: 200 };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    await db
      .update(files)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(files.id, fileId));

    throw badRequest("FILE_NOT_UPLOADED", "فایل در ذخیره‌سازی پیدا نشد");
  }
}

export async function reprocessFile(fileId: string): Promise<CompleteFileResult> {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  if (file.kind !== "audio") {
    throw badRequest("NOT_AUDIO", "فقط فایل صوتی قابل پردازش مجدد است");
  }
  if (file.status !== "failed") {
    throw badRequest("NOT_FAILED", "فقط فایل‌های failed قابل پردازش مجدد هستند");
  }
  if (!file.storageKey) {
    throw badRequest("FILE_NO_STORAGE", "فایل ذخیره‌سازی ندارد");
  }

  const [processing] = await db
    .update(files)
    .set({
      status: "processing",
      processingError: null,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId))
    .returning();

  if (!processing) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }

  scheduleProcessAudio(fileId);
  return { file: toFileDto(processing), httpStatus: 202 };
}

export async function createTextFile(input: {
  userId: string;
  sessionId: string;
  topicId?: string;
  content: string;
}) {
  const { session, topic } = await resolveSessionAndTopic(input.sessionId, input.topicId);
  const content = input.content.trim();
  if (!content) {
    throw badRequest("EMPTY_TEXT", "متن خالی است");
  }

  const file = await db.transaction(async (tx) => {
    const number = await nextFileNumber(tx, {
      sessionId: session.id,
      topicId: topic?.id ?? null,
      kind: "text",
    });

    const [created] = await tx
      .insert(files)
      .values({
        groupId: session.groupId,
        sessionId: session.id,
        topicId: topic?.id ?? null,
        kind: "text",
        number,
        title: null,
        storageKey: null,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(content, "utf8"),
        textContent: content,
        status: "ready",
        uploadedBy: input.userId,
      })
      .returning();

    if (!created) {
      throw badRequest("FILE_CREATE_FAILED", "ساخت فایل متنی ناموفق بود");
    }
    return created;
  });

  return toFileDto(file, { includeText: true });
}

export async function getFileDownloadUrl(fileId: string, download: boolean) {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  if (file.status !== "ready") {
    throw badRequest("FILE_NOT_READY", "فایل آماده نیست");
  }
  if (file.kind === "text") {
    throw badRequest("TEXT_NO_URL", "فایل متنی URL ندارد");
  }
  if (!file.storageKey) {
    throw badRequest("FILE_NO_STORAGE", "فایل ذخیره‌سازی ندارد");
  }

  const displayName = fileDisplayName(file);
  const ext = extensionForMime(file.mimeType, file.kind);
  const fileName = `${displayName}.${ext}`;
  const url = await createDownloadUrl(file.storageKey, {
    expiresIn: 3600,
    download,
    fileName,
  });

  return { url, expiresIn: 3600, displayName };
}

export async function updateFileTitle(fileId: string, title: string | null) {
  const [file] = await db
    .update(files)
    .set({ title: title === null ? null : title.trim(), updatedAt: new Date() })
    .where(eq(files.id, fileId))
    .returning();
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  return toFileDto(file, { includeText: file.kind === "text" });
}

export async function deleteFile(fileId: string) {
  const [file] = await db.delete(files).where(eq(files.id, fileId)).returning();
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  if (file.storageKey) {
    await deleteStorageKeys([file.storageKey]);
  }
}

export async function getPlaylist(sessionId: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }

  const topicRows = await db.query.topics.findMany({
    where: eq(topics.sessionId, sessionId),
    orderBy: [asc(topics.number)],
  });

  const audioFiles = await db.query.files.findMany({
    where: and(eq(files.sessionId, sessionId), eq(files.kind, "audio"), eq(files.status, "ready")),
    orderBy: [asc(files.number)],
  });

  const direct = audioFiles
    .filter((file) => file.topicId === null)
    .sort((a, b) => a.number - b.number);

  const byTopic = new Map<string, FileRow[]>();
  for (const file of audioFiles) {
    if (!file.topicId) continue;
    const list = byTopic.get(file.topicId) ?? [];
    list.push(file);
    byTopic.set(file.topicId, list);
  }

  const items = [];

  for (const file of direct) {
    if (!file.storageKey) continue;
    items.push({
      fileId: file.id,
      displayName: fileDisplayName(file),
      durationMs: file.durationMs,
      url: await createDownloadUrl(file.storageKey, { expiresIn: 3600 }),
    });
  }

  for (const topic of topicRows) {
    const list = (byTopic.get(topic.id) ?? []).sort((a, b) => a.number - b.number);
    for (const file of list) {
      if (!file.storageKey) continue;
      items.push({
        fileId: file.id,
        displayName: fileDisplayName(file),
        topicDisplayName: topicDisplayName(topic),
        durationMs: file.durationMs,
        url: await createDownloadUrl(file.storageKey, { expiresIn: 3600 }),
      });
    }
  }

  return { items };
}

export async function getFileOrThrow(fileId: string) {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    throw notFound("FILE_NOT_FOUND", "فایل پیدا نشد");
  }
  return file;
}

export async function getSessionOrThrow(sessionId: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) {
    throw notFound("SESSION_NOT_FOUND", "جلسه پیدا نشد");
  }
  return session;
}

export async function getTopicOrThrow(topicId: string) {
  const topic = await db.query.topics.findFirst({ where: eq(topics.id, topicId) });
  if (!topic) {
    throw notFound("TOPIC_NOT_FOUND", "تاپیک پیدا نشد");
  }
  return topic;
}

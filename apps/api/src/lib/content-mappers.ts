import type { FileDto, FileKind, FileStatus } from "@app/shared-types";
import type { FileRow, Session, Topic } from "../db/schema";
import { fileDisplayName, sessionDisplayName, topicDisplayName } from "@app/shared-types";

export function toSessionSummary(
  session: Session,
  counts: { topicCount: number; fileCount: number },
) {
  return {
    id: session.id,
    groupId: session.groupId,
    number: session.number,
    title: session.title,
    displayName: sessionDisplayName(session),
    topicCount: counts.topicCount,
    fileCount: counts.fileCount,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function toTopicSummary(topic: Topic, fileCount: number) {
  return {
    id: topic.id,
    sessionId: topic.sessionId,
    number: topic.number,
    title: topic.title,
    displayName: topicDisplayName(topic),
    fileCount,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

export function toFileDto(file: FileRow, options?: { includeText?: boolean }): FileDto {
  return {
    id: file.id,
    groupId: file.groupId,
    sessionId: file.sessionId,
    topicId: file.topicId,
    kind: file.kind as FileKind,
    number: file.number,
    title: file.title,
    displayName: fileDisplayName(file),
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    durationMs: file.durationMs,
    ...(file.kind === "text" || options?.includeText ? { textContent: file.textContent } : {}),
    status: file.status as FileStatus,
    processingError: file.processingError,
    source: file.source,
    uploadedBy: file.uploadedBy,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

export function visibleFiles(files: FileRow[], canSeeIncomplete: boolean): FileRow[] {
  if (canSeeIncomplete) {
    return files;
  }
  return files.filter((file) => file.status === "ready");
}

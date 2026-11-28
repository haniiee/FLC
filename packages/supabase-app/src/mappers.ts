import type {
  ChatMessage,
  FileDto,
  GroupRole,
  SessionDetail,
  SessionSummary,
  TopicDetail,
  TopicSummary,
  User,
} from "@app/shared-types";
import {
  fileDisplayName,
  sessionDisplayName,
  topicDisplayName,
} from "@app/shared-types";
import type { DbChatMessage, DbFile, DbSession, DbTopic, DbUser } from "./types";

export function mapUser(row: DbUser): User {
  return {
    id: row.id,
    phone: row.phone,
    displayName: row.display_name,
    platformRole: row.platform_role,
    mustChangePassword: row.must_change_password,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapFile(row: DbFile): FileDto {
  return {
    id: row.id,
    groupId: row.group_id,
    sessionId: row.session_id,
    topicId: row.topic_id,
    kind: row.kind,
    number: row.number,
    title: row.title,
    displayName: fileDisplayName({
      number: row.number,
      title: row.title,
      kind: row.kind,
    }),
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    ...(row.kind === "text" ? { textContent: row.text_content } : {}),
    status: row.status,
    processingError: row.processing_error ?? undefined,
    source: row.source,
    uploadedBy: row.uploaded_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapSessionSummary(
  row: DbSession,
  counts: { topicCount: number; fileCount: number },
): SessionSummary {
  return {
    id: row.id,
    groupId: row.group_id,
    number: row.number,
    title: row.title,
    displayName: sessionDisplayName({ number: row.number, title: row.title }),
    topicCount: counts.topicCount,
    fileCount: counts.fileCount,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapSessionDetailSession(row: DbSession): SessionDetail["session"] {
  return {
    id: row.id,
    groupId: row.group_id,
    number: row.number,
    title: row.title,
    displayName: sessionDisplayName({ number: row.number, title: row.title }),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapTopicSummary(row: DbTopic, fileCount: number): TopicSummary {
  return {
    id: row.id,
    sessionId: row.session_id,
    number: row.number,
    title: row.title,
    displayName: topicDisplayName({ number: row.number, title: row.title }),
    fileCount,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapTopicDetailTopic(row: DbTopic): TopicDetail["topic"] {
  return {
    id: row.id,
    sessionId: row.session_id,
    number: row.number,
    title: row.title,
    displayName: topicDisplayName({ number: row.number, title: row.title }),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapChatMessage(
  row: DbChatMessage,
  sender: { id: string; displayName: string; role: GroupRole },
): ChatMessage {
  const deleted = row.deleted_at !== null;
  const textContent = row.text ?? row.body ?? null;
  return {
    id: row.id,
    channelId: row.channel_id,
    type: row.type,
    text: deleted ? null : textContent,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    durationMs: row.duration_ms,
    status: row.status === "pending" && row.type === "text" ? "ready" : (row.status ?? "ready"),
    processingError: row.processing_error ?? undefined,
    replyToId: row.reply_to_id,
    createdAt: new Date(row.created_at).toISOString(),
    deleted,
    sender: {
      id: sender.id,
      displayName: sender.displayName,
      role: sender.role,
    },
  };
}
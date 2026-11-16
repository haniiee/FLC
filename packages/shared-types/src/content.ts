import { z } from "zod";

export const FileKindSchema = z.enum(["audio", "pdf", "image", "video", "text"]);
export type FileKind = z.infer<typeof FileKindSchema>;

export const FileStatusSchema = z.enum(["pending", "ready", "failed"]);
export type FileStatus = z.infer<typeof FileStatusSchema>;

export const CreateSessionBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;

export const UpdateTitleBodySchema = z.object({
  title: z.string().min(1).max(200).nullable(),
});
export type UpdateTitleBody = z.infer<typeof UpdateTitleBodySchema>;

export const CreateTopicBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
export type CreateTopicBody = z.infer<typeof CreateTopicBodySchema>;

export const FileSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  sessionId: z.string().uuid(),
  topicId: z.string().uuid().nullable(),
  kind: FileKindSchema,
  number: z.number().int().positive(),
  title: z.string().nullable(),
  displayName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  textContent: z.string().nullable().optional(),
  status: FileStatusSchema,
  uploadedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FileDto = z.infer<typeof FileSchema>;

export const TopicSummarySchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string().nullable(),
  displayName: z.string(),
  fileCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TopicSummary = z.infer<typeof TopicSummarySchema>;

export const SessionSummarySchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string().nullable(),
  displayName: z.string(),
  topicCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionsListResponseSchema = z.object({
  sessions: z.array(SessionSummarySchema),
});
export type SessionsListResponse = z.infer<typeof SessionsListResponseSchema>;

export const SessionDetailSchema = z.object({
  session: SessionSummarySchema.omit({ topicCount: true, fileCount: true }).extend({
    createdBy: z.string().uuid(),
  }),
  topics: z.array(TopicSummarySchema),
  files: z.array(FileSchema),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

export const TopicDetailSchema = z.object({
  topic: TopicSummarySchema.omit({ fileCount: true }).extend({
    createdBy: z.string().uuid(),
  }),
  files: z.array(FileSchema),
});
export type TopicDetail = z.infer<typeof TopicDetailSchema>;

export const UploadUrlBodySchema = z.object({
  sessionId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
});
export type UploadUrlBody = z.infer<typeof UploadUrlBodySchema>;

export const UploadUrlResponseSchema = z.object({
  file: FileSchema,
  uploadUrl: z.string().url(),
  expiresIn: z.literal(900),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

export const CompleteFileBodySchema = z.object({
  durationMs: z.number().int().positive().optional(),
});
export type CompleteFileBody = z.infer<typeof CompleteFileBodySchema>;

export const CreateTextFileBodySchema = z.object({
  sessionId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  content: z.string().min(1),
});
export type CreateTextFileBody = z.infer<typeof CreateTextFileBodySchema>;

export const FileUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
  displayName: z.string(),
});
export type FileUrlResponse = z.infer<typeof FileUrlResponseSchema>;

export const PlaylistItemSchema = z.object({
  fileId: z.string().uuid(),
  displayName: z.string(),
  topicDisplayName: z.string().optional(),
  durationMs: z.number().int().nonnegative().nullable(),
  url: z.string().url(),
});
export type PlaylistItem = z.infer<typeof PlaylistItemSchema>;

export const PlaylistResponseSchema = z.object({
  items: z.array(PlaylistItemSchema),
});
export type PlaylistResponse = z.infer<typeof PlaylistResponseSchema>;

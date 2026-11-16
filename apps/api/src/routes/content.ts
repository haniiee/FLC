import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  CompleteFileBodySchema,
  CreateSessionBodySchema,
  CreateTextFileBodySchema,
  CreateTopicBodySchema,
  FileSchema,
  FileUrlResponseSchema,
  OkResponseSchema,
  PlaylistResponseSchema,
  SessionDetailSchema,
  SessionSummarySchema,
  SessionsListResponseSchema,
  TopicDetailSchema,
  TopicSummarySchema,
  UpdateTitleBodySchema,
  UploadUrlBodySchema,
  UploadUrlResponseSchema,
} from "@app/shared-types";
import { z } from "zod";
import { requireGroupRole } from "../lib/group-access";
import {
  completeFileUpload,
  createSession,
  createTextFile,
  createTopic,
  createUploadUrlForFile,
  deleteFile,
  deleteSession,
  deleteTopic,
  getFileDownloadUrl,
  getFileOrThrow,
  getPlaylist,
  getSessionDetail,
  getSessionOrThrow,
  getTopicDetail,
  getTopicOrThrow,
  listSessions,
  updateFileTitle,
  updateSessionTitle,
  updateTopicTitle,
} from "../services/content-service";

const GroupParams = z.object({ groupId: z.string().uuid() });
const IdParams = z.object({ id: z.string().uuid() });
const FileUrlQuery = z.object({
  download: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
});

export const contentRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/groups/:groupId/sessions",
    {
      schema: {
        params: GroupParams,
        response: { 200: SessionsListResponseSchema },
      },
    },
    async (request) => {
      const role = await requireGroupRole(app, request, request.params.groupId, [
        "teacher",
        "assistant",
        "student",
      ]);
      return { sessions: await listSessions(request.params.groupId, role) };
    },
  );

  app.post(
    "/groups/:groupId/sessions",
    {
      schema: {
        params: GroupParams,
        body: CreateSessionBodySchema,
        response: { 200: SessionSummarySchema },
      },
    },
    async (request) => {
      await requireGroupRole(app, request, request.params.groupId, ["teacher", "assistant"]);
      return createSession(request.params.groupId, request.user.sub, request.body.title);
    },
  );

  app.get(
    "/sessions/:id",
    {
      schema: {
        params: IdParams,
        response: { 200: SessionDetailSchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.params.id);
      const role = await requireGroupRole(app, request, session.groupId, [
        "teacher",
        "assistant",
        "student",
      ]);
      return getSessionDetail(session.id, role);
    },
  );

  app.patch(
    "/sessions/:id",
    {
      schema: {
        params: IdParams,
        body: UpdateTitleBodySchema,
        response: { 200: SessionSummarySchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.params.id);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      return updateSessionTitle(session.id, request.body.title);
    },
  );

  app.delete(
    "/sessions/:id",
    {
      schema: {
        params: IdParams,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.params.id);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      await deleteSession(session.id);
      return { ok: true as const };
    },
  );

  app.post(
    "/sessions/:id/topics",
    {
      schema: {
        params: IdParams,
        body: CreateTopicBodySchema,
        response: { 200: TopicSummarySchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.params.id);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      return createTopic(session.id, request.user.sub, request.body.title);
    },
  );

  app.get(
    "/topics/:id",
    {
      schema: {
        params: IdParams,
        response: { 200: TopicDetailSchema },
      },
    },
    async (request) => {
      const topic = await getTopicOrThrow(request.params.id);
      const session = await getSessionOrThrow(topic.sessionId);
      const role = await requireGroupRole(app, request, session.groupId, [
        "teacher",
        "assistant",
        "student",
      ]);
      return getTopicDetail(topic.id, role);
    },
  );

  app.patch(
    "/topics/:id",
    {
      schema: {
        params: IdParams,
        body: UpdateTitleBodySchema,
        response: { 200: TopicSummarySchema },
      },
    },
    async (request) => {
      const topic = await getTopicOrThrow(request.params.id);
      const session = await getSessionOrThrow(topic.sessionId);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      return updateTopicTitle(topic.id, request.body.title);
    },
  );

  app.delete(
    "/topics/:id",
    {
      schema: {
        params: IdParams,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      const topic = await getTopicOrThrow(request.params.id);
      const session = await getSessionOrThrow(topic.sessionId);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      await deleteTopic(topic.id);
      return { ok: true as const };
    },
  );

  app.post(
    "/files/upload-url",
    {
      schema: {
        body: UploadUrlBodySchema,
        response: { 200: UploadUrlResponseSchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.body.sessionId);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      return createUploadUrlForFile({
        userId: request.user.sub,
        sessionId: request.body.sessionId,
        topicId: request.body.topicId,
        mimeType: request.body.mimeType,
        sizeBytes: request.body.sizeBytes,
        fileName: request.body.fileName,
      });
    },
  );

  app.post(
    "/files/:id/complete",
    {
      schema: {
        params: IdParams,
        body: CompleteFileBodySchema,
        response: { 200: FileSchema },
      },
    },
    async (request) => {
      const file = await getFileOrThrow(request.params.id);
      await requireGroupRole(app, request, file.groupId, ["teacher", "assistant"]);
      return completeFileUpload(file.id, request.body.durationMs);
    },
  );

  app.post(
    "/files/text",
    {
      schema: {
        body: CreateTextFileBodySchema,
        response: { 200: FileSchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.body.sessionId);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant"]);
      return createTextFile({
        userId: request.user.sub,
        sessionId: request.body.sessionId,
        topicId: request.body.topicId,
        content: request.body.content,
      });
    },
  );

  app.get(
    "/files/:id/url",
    {
      schema: {
        params: IdParams,
        querystring: FileUrlQuery,
        response: { 200: FileUrlResponseSchema },
      },
    },
    async (request) => {
      const file = await getFileOrThrow(request.params.id);
      await requireGroupRole(app, request, file.groupId, ["teacher", "assistant", "student"]);
      const download = request.query.download === "1" || request.query.download === "true";
      return getFileDownloadUrl(file.id, download);
    },
  );

  app.patch(
    "/files/:id",
    {
      schema: {
        params: IdParams,
        body: UpdateTitleBodySchema,
        response: { 200: FileSchema },
      },
    },
    async (request) => {
      const file = await getFileOrThrow(request.params.id);
      await requireGroupRole(app, request, file.groupId, ["teacher", "assistant"]);
      return updateFileTitle(file.id, request.body.title);
    },
  );

  app.delete(
    "/files/:id",
    {
      schema: {
        params: IdParams,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      const file = await getFileOrThrow(request.params.id);
      await requireGroupRole(app, request, file.groupId, ["teacher", "assistant"]);
      await deleteFile(file.id);
      return { ok: true as const };
    },
  );

  app.get(
    "/sessions/:id/playlist",
    {
      schema: {
        params: IdParams,
        response: { 200: PlaylistResponseSchema },
      },
    },
    async (request) => {
      const session = await getSessionOrThrow(request.params.id);
      await requireGroupRole(app, request, session.groupId, ["teacher", "assistant", "student"]);
      return getPlaylist(session.id);
    },
  );
};

import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  ChatChannelsResponseSchema,
  ChatMessageSchema,
  ChatMessagesResponseSchema,
  ChatMessageUrlResponseSchema,
  ChatVoiceUploadBodySchema,
  ChatVoiceUploadResponseSchema,
  CreateChatTextBodySchema,
  OkResponseSchema,
} from "@app/shared-types";
import { z } from "zod";
import {
  completeChatVoice,
  createTextMessage,
  createVoiceUploadUrl,
  deleteChatMessage,
  getChatMessageUrl,
  listChannelMessages,
  listGroupChats,
} from "../services/chat-service";

const GroupIdParams = z.object({ groupId: z.string().uuid() });
const ChannelIdParams = z.object({ channelId: z.string().uuid() });
const MessageIdParams = z.object({ id: z.string().uuid() });

const MessagesQuery = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const messageRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: "10 seconds",
    },
  },
};

export const chatRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/groups/:groupId/chats",
    {
      schema: {
        params: GroupIdParams,
        response: { 200: ChatChannelsResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      const channels = await listGroupChats(request.user.sub, request.params.groupId);
      return { channels };
    },
  );

  app.get(
    "/chats/:channelId/messages",
    {
      schema: {
        params: ChannelIdParams,
        querystring: MessagesQuery,
        response: { 200: ChatMessagesResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      const messages = await listChannelMessages({
        userId: request.user.sub,
        channelId: request.params.channelId,
        before: request.query.before,
        limit: request.query.limit,
      });
      return { messages };
    },
  );

  app.post(
    "/chats/:channelId/messages",
    {
      ...messageRateLimit,
      schema: {
        params: ChannelIdParams,
        body: CreateChatTextBodySchema,
        response: { 200: ChatMessageSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return createTextMessage({
        userId: request.user.sub,
        channelId: request.params.channelId,
        text: request.body.text,
        replyToId: request.body.replyToId,
      });
    },
  );

  app.post(
    "/chats/:channelId/voice/upload-url",
    {
      ...messageRateLimit,
      schema: {
        params: ChannelIdParams,
        body: ChatVoiceUploadBodySchema,
        response: { 200: ChatVoiceUploadResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return createVoiceUploadUrl({
        userId: request.user.sub,
        channelId: request.params.channelId,
        mimeType: request.body.mimeType,
        sizeBytes: request.body.sizeBytes,
      });
    },
  );

  app.post(
    "/chat-messages/:id/complete",
    {
      schema: {
        params: MessageIdParams,
        response: { 202: ChatMessageSchema },
      },
    },
    async (request, reply) => {
      await app.authenticate(request);
      const result = await completeChatVoice(request.params.id, request.user.sub);
      return reply.status(202).send(result.message);
    },
  );

  app.get(
    "/chat-messages/:id/url",
    {
      schema: {
        params: MessageIdParams,
        response: { 200: ChatMessageUrlResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return getChatMessageUrl(request.params.id, request.user.sub);
    },
  );

  app.delete(
    "/chat-messages/:id",
    {
      schema: {
        params: MessageIdParams,
        response: { 200: OkResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return deleteChatMessage(request.params.id, request.user.sub);
    },
  );
};

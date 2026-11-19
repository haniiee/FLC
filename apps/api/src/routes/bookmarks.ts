import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  BookmarkSchema,
  BookmarksListResponseSchema,
  BookmarksQuerySchema,
  CreateBookmarkBodySchema,
  UpdateBookmarkBodySchema,
} from "@app/shared-types";
import { z } from "zod";
import {
  createBookmark,
  deleteBookmark,
  listBookmarks,
  updateBookmarkNote,
} from "../services/bookmark-service";

const IdParams = z.object({ id: z.string().uuid() });

export const bookmarkRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/me/bookmarks",
    {
      schema: {
        querystring: BookmarksQuerySchema,
        response: { 200: BookmarksListResponseSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return listBookmarks(request.user.sub, request.query);
    },
  );

  app.post(
    "/me/bookmarks",
    {
      schema: {
        body: CreateBookmarkBodySchema,
        response: { 200: BookmarkSchema, 201: BookmarkSchema },
      },
    },
    async (request, reply) => {
      await app.authenticate(request);
      const result = await createBookmark(request.user.sub, request.body);
      return reply.status(result.created ? 201 : 200).send(result.bookmark);
    },
  );

  app.patch(
    "/bookmarks/:id",
    {
      schema: {
        params: IdParams,
        body: UpdateBookmarkBodySchema,
        response: { 200: BookmarkSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return updateBookmarkNote(request.user.sub, request.params.id, request.body.note);
    },
  );

  app.delete("/bookmarks/:id", { schema: { params: IdParams } }, async (request, reply) => {
    await app.authenticate(request);
    await deleteBookmark(request.user.sub, request.params.id);
    return reply.code(204).send();
  });
};

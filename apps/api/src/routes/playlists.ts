import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  AddPlaylistItemsBodySchema,
  CreatePlaylistBodySchema,
  PlaylistDetailSchema,
  PlaylistsListResponseSchema,
  ReorderPlaylistBodySchema,
  UpdatePlaylistBodySchema,
} from "@app/shared-types";
import { z } from "zod";
import {
  addPlaylistItems,
  createPlaylist,
  deletePlaylist,
  getPlaylistDetail,
  listPlaylists,
  removePlaylistItem,
  reorderPlaylist,
  updatePlaylistTitle,
} from "../services/playlist-service";

const IdParams = z.object({ id: z.string().uuid() });
const ItemParams = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
});

export const playlistRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/me/playlists",
    { schema: { response: { 200: PlaylistsListResponseSchema } } },
    async (request) => {
      await app.authenticate(request);
      return listPlaylists(request.user.sub);
    },
  );

  app.post(
    "/me/playlists",
    {
      schema: {
        body: CreatePlaylistBodySchema,
        response: { 201: PlaylistDetailSchema },
      },
    },
    async (request, reply) => {
      await app.authenticate(request);
      const playlist = await createPlaylist(request.user.sub, request.body);
      return reply.status(201).send(playlist);
    },
  );

  app.get(
    "/playlists/:id",
    {
      schema: {
        params: IdParams,
        response: { 200: PlaylistDetailSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return getPlaylistDetail(request.user.sub, request.params.id);
    },
  );

  app.patch(
    "/playlists/:id",
    {
      schema: {
        params: IdParams,
        body: UpdatePlaylistBodySchema,
        response: { 200: PlaylistDetailSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return updatePlaylistTitle(request.user.sub, request.params.id, request.body.title);
    },
  );

  app.delete("/playlists/:id", { schema: { params: IdParams } }, async (request, reply) => {
    await app.authenticate(request);
    await deletePlaylist(request.user.sub, request.params.id);
    return reply.code(204).send();
  });

  app.post(
    "/playlists/:id/items",
    {
      schema: {
        params: IdParams,
        body: AddPlaylistItemsBodySchema,
        response: { 200: PlaylistDetailSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return addPlaylistItems(request.user.sub, request.params.id, request.body.fileIds);
    },
  );

  app.delete(
    "/playlists/:id/items/:fileId",
    {
      schema: {
        params: ItemParams,
        response: { 200: PlaylistDetailSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return removePlaylistItem(request.user.sub, request.params.id, request.params.fileId);
    },
  );

  app.put(
    "/playlists/:id/order",
    {
      schema: {
        params: IdParams,
        body: ReorderPlaylistBodySchema,
        response: { 200: PlaylistDetailSchema },
      },
    },
    async (request) => {
      await app.authenticate(request);
      return reorderPlaylist(request.user.sub, request.params.id, request.body.fileIds);
    },
  );
};

import type { FastifyPluginAsync } from "fastify";
import { unauthorized } from "../lib/errors";
import {
  supabaseFetchDownload,
  supabaseUploadFromRequest,
  verifyStorageToken,
} from "../storage-supabase";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export const storageProxyRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    "*",
    { parseAs: "buffer", bodyLimit: MAX_UPLOAD_BYTES },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.put<{ Params: { token: string } }>(
    "/storage/upload/:token",
    { bodyLimit: MAX_UPLOAD_BYTES },
    async (request, reply) => {
      let payload;
      try {
        payload = verifyStorageToken(request.params.token);
      } catch {
        throw unauthorized("INVALID_STORAGE_TOKEN", "لینک آپلود نامعتبر است");
      }
      if (payload.purpose !== "upload") {
        throw unauthorized("INVALID_STORAGE_TOKEN", "لینک آپلود نامعتبر است");
      }

      const contentType =
        (typeof request.headers["content-type"] === "string"
          ? request.headers["content-type"]
          : undefined) ||
        payload.mime ||
        "application/octet-stream";

      const body = request.body;
      if (!Buffer.isBuffer(body)) {
        throw unauthorized("INVALID_STORAGE_TOKEN", "بدنهٔ آپلود نامعتبر است");
      }

      await supabaseUploadFromRequest(payload.key, contentType, body);
      return reply.status(200).send({ ok: true });
    },
  );

  app.get<{ Params: { token: string } }>("/storage/download/:token", async (request, reply) => {
    let payload;
    try {
      payload = verifyStorageToken(request.params.token);
    } catch {
      throw unauthorized("INVALID_STORAGE_TOKEN", "لینک دانلود نامعتبر است");
    }
    if (payload.purpose !== "download") {
      throw unauthorized("INVALID_STORAGE_TOKEN", "لینک دانلود نامعتبر است");
    }

    const upstream = await supabaseFetchDownload(payload.key);
    if (!upstream.ok || !upstream.body) {
      return reply.status(upstream.status === 404 ? 404 : 502).send({
        error: { code: "STORAGE_ERROR", message: "فایل پیدا نشد" },
      });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    reply.header("Content-Type", contentType);
    const length = upstream.headers.get("content-length");
    if (length) reply.header("Content-Length", length);
    if (payload.download && payload.fileName) {
      reply.header(
        "Content-Disposition",
        `attachment; filename="${payload.fileName.replace(/"/g, "")}"`,
      );
    }

    return reply.send(upstream.body);
  });
};

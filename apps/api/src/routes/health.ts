import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@app/shared-types";
import { sql } from "../db/index";
import { checkFfmpeg } from "../media/process-audio";
import { checkStorage } from "../storage";

async function checkDb(): Promise<"ok" | "down"> {
  try {
    await sql`select 1`;
    return "ok";
  } catch {
    return "down";
  }
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (): Promise<HealthResponse> => {
    const [dbStatus, storageStatus, ffmpegStatus] = await Promise.all([
      checkDb(),
      checkStorage(),
      checkFfmpeg(),
    ]);

    return {
      status: "ok",
      db: dbStatus,
      storage: storageStatus,
      ffmpeg: ffmpegStatus,
    };
  });
};

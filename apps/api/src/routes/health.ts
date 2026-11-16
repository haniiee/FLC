import type { FastifyPluginAsync } from "fastify";
import type { HealthResponse } from "@app/shared-types";
import { sql } from "../db/index";
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
    const [dbStatus, storageStatus] = await Promise.all([checkDb(), checkStorage()]);

    return {
      status: "ok",
      db: dbStatus,
      storage: storageStatus,
    };
  });
};

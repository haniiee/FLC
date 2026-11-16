import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.enum(["ok", "down"]),
  storage: z.enum(["ok", "down"]),
  ffmpeg: z.enum(["ok", "missing"]),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

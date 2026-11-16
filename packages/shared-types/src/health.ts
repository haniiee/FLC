import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.enum(["ok", "down"]),
  storage: z.enum(["ok", "down"]),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

loadDotenv({ path: resolve(process.cwd(), "../../.env") });
loadDotenv();

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DATABASE_URL_TEST: z.string().min(1).optional(),
    STORAGE_DRIVER: z.enum(["s3", "supabase"]).default("s3"),
    S3_ENDPOINT: z.string().url("S3_ENDPOINT must be a valid URL").optional(),
    S3_PUBLIC_ENDPOINT: z.string().url("S3_PUBLIC_ENDPOINT must be a valid URL").optional(),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    API_PUBLIC_URL: z.string().url().optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    PORT: z.coerce.number().int().positive().optional(),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    WEB_URL: z.string().url("WEB_URL must be a valid URL"),
    FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
    FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
    if (value.STORAGE_DRIVER === "supabase") {
      for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "API_PUBLIC_URL"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=supabase`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

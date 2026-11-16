import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(process.cwd(), "../../.env") });
loadDotenv();

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error("DATABASE_URL_TEST is required for tests");
}

process.env.DATABASE_URL = testUrl;
process.env.JWT_SECRET ??= "test-jwt-secret-flc-123456";
process.env.WEB_URL ??= "http://localhost:3000";
process.env.S3_ENDPOINT ??= "http://localhost:9000";
process.env.S3_PUBLIC_ENDPOINT ??= process.env.S3_ENDPOINT;
process.env.S3_REGION ??= "us-east-1";
process.env.S3_ACCESS_KEY ??= "minioadmin";
process.env.S3_SECRET_KEY ??= "minioadmin";
process.env.S3_BUCKET ??= "class-files";

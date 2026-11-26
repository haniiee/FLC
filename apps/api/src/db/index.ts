import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

const useSsl =
  /supabase\.co/i.test(env.DATABASE_URL) ||
  /[?&]sslmode=require/i.test(env.DATABASE_URL) ||
  process.env.DATABASE_SSL === "true";

const client = postgres(env.DATABASE_URL, {
  max: 10,
  ssl: useSsl ? "require" : undefined,
});

export const db = drizzle(client, { schema });
export { client as sql };

import { eq } from "drizzle-orm";
import { db, sql } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../lib/password";
import { normalizePhone } from "../lib/phone";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const phoneRaw = readArg("--phone");
  const name = readArg("--name");
  const password = readArg("--password");

  if (!phoneRaw || !name || !password) {
    console.error(
      'Usage: pnpm --filter @app/api db:seed-teacher -- --phone 09... --name "..." --password "..."',
    );
    process.exit(1);
  }

  const phone = normalizePhone(phoneRaw);
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        platformRole: "teacher",
        displayName: name,
        passwordHash: await hashPassword(password),
      })
      .where(eq(users.id, existing.id))
      .returning();

    console.log(`Updated teacher: ${updated?.id} (${phone})`);
  } else {
    const [created] = await db
      .insert(users)
      .values({
        phone,
        displayName: name,
        passwordHash: await hashPassword(password),
        platformRole: "teacher",
      })
      .returning();

    console.log(`Created teacher: ${created?.id} (${phone})`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

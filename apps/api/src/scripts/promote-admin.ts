import { eq } from "drizzle-orm";
import { db, sql } from "../db";
import { users } from "../db/schema";
import { normalizePhone } from "../lib/phone";

export async function promoteAdminByPhone(
  phoneRaw: string,
): Promise<{ id: string; phone: string }> {
  const phone = normalizePhone(phoneRaw);
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  if (!existing) {
    throw new Error(`User not found for phone ${phone}`);
  }

  const [updated] = await db
    .update(users)
    .set({ platformRole: "admin" })
    .where(eq(users.id, existing.id))
    .returning({ id: users.id, phone: users.phone });

  if (!updated) {
    throw new Error(`Failed to promote admin for phone ${phone}`);
  }

  return updated;
}

async function main() {
  const phoneRaw = process.argv[2];
  if (!phoneRaw) {
    console.error("Usage: pnpm admin:promote 0912xxxxxxx");
    process.exit(1);
  }

  try {
    const updated = await promoteAdminByPhone(phoneRaw);
    console.log(`Promoted admin: ${updated.id} (${updated.phone})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const isDirectRun = process.argv[1]?.includes("promote-admin");
if (isDirectRun) {
  void main();
}

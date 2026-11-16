import { and, eq, isNull } from "drizzle-orm";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { db } from "../db";
import { files } from "../db/schema";
import { probe } from "../media/ffprobe";
import { downloadObjectStream } from "../storage";

async function main() {
  const rows = await db.query.files.findMany({
    where: and(eq(files.kind, "audio"), eq(files.status, "ready"), isNull(files.durationMs)),
  });

  console.log(`[backfill] ${rows.length} ready audio file(s) missing durationMs`);

  let updated = 0;
  let failed = 0;

  for (const file of rows) {
    if (!file.storageKey) {
      console.warn(`[backfill] skip ${file.id}: no storageKey`);
      failed += 1;
      continue;
    }

    const workDir = await mkdtemp(join(tmpdir(), "flc-backfill-"));
    const inputPath = join(workDir, `input${extname(file.storageKey) || ".bin"}`);

    try {
      const body = await downloadObjectStream(file.storageKey);
      if (!body) {
        throw new Error("empty body");
      }
      await pipeline(body as Readable, createWriteStream(inputPath));
      const probed = await probe(inputPath);
      await db
        .update(files)
        .set({ durationMs: probed.durationMs, updatedAt: new Date() })
        .where(eq(files.id, file.id));
      updated += 1;
      console.log(`[backfill] ${file.id} durationMs=${probed.durationMs}`);
    } catch (error) {
      failed += 1;
      console.error(`[backfill] failed ${file.id}`, error);
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  console.log(`[backfill] done updated=${updated} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { and, eq, isNull, max, ne, sql } from "drizzle-orm";
import type { FileKind } from "@app/shared-types";
import { db } from "../db";
import { files, sessions, topics } from "../db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function nextSessionNumber(tx: Tx, groupId: string): Promise<number> {
  await tx.execute(sql`select id from groups where id = ${groupId} for update`);
  const [row] = await tx
    .select({ value: max(sessions.number) })
    .from(sessions)
    .where(eq(sessions.groupId, groupId));
  return (row?.value ?? 0) + 1;
}

export async function nextTopicNumber(tx: Tx, sessionId: string): Promise<number> {
  await tx.execute(sql`select id from sessions where id = ${sessionId} for update`);
  const [row] = await tx
    .select({ value: max(topics.number) })
    .from(topics)
    .where(eq(topics.sessionId, sessionId));
  return (row?.value ?? 0) + 1;
}

async function lockFileContainer(
  tx: Tx,
  input: { sessionId: string; topicId: string | null },
): Promise<void> {
  if (input.topicId) {
    await tx.execute(sql`select id from topics where id = ${input.topicId} for update`);
    return;
  }
  await tx.execute(sql`select id from sessions where id = ${input.sessionId} for update`);
}

/**
 * Next Voice/PDF/… number for a container.
 * Pending rows are not deleted and do not reserve numbers: max is taken over
 * non-pending rows only. Caller must be inside a transaction.
 */
export async function nextFileNumber(
  tx: Tx,
  input: { sessionId: string; topicId: string | null; kind: FileKind },
): Promise<number> {
  await lockFileContainer(tx, input);
  return readNextFileNumber(tx, input);
}

/**
 * Number to persist when a pending upload completes.
 * Idempotent: a row that already has a number keeps it.
 * Otherwise max(non-pending)+1 under the container lock.
 */
export async function fileNumberForComplete(
  tx: Tx,
  file: { id: string; sessionId: string; topicId: string | null; kind: FileKind },
): Promise<number> {
  await lockFileContainer(tx, file);
  const [fresh] = await tx
    .select({ number: files.number })
    .from(files)
    .where(eq(files.id, file.id));
  if (fresh?.number != null) {
    return fresh.number;
  }
  return readNextFileNumber(tx, file);
}

async function readNextFileNumber(
  tx: Tx,
  input: { sessionId: string; topicId: string | null; kind: FileKind },
): Promise<number> {
  const scope = input.topicId
    ? and(eq(files.topicId, input.topicId), eq(files.kind, input.kind), ne(files.status, "pending"))
    : and(
        eq(files.sessionId, input.sessionId),
        isNull(files.topicId),
        eq(files.kind, input.kind),
        ne(files.status, "pending"),
      );
  const [row] = await tx
    .select({ value: max(files.number) })
    .from(files)
    .where(scope);
  return (row?.value ?? 0) + 1;
}

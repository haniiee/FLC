import { and, eq, isNull, max, sql } from "drizzle-orm";
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

export async function nextFileNumber(
  tx: Tx,
  input: { sessionId: string; topicId: string | null; kind: FileKind },
): Promise<number> {
  if (input.topicId) {
    await tx.execute(sql`select id from topics where id = ${input.topicId} for update`);
    const [row] = await tx
      .select({ value: max(files.number) })
      .from(files)
      .where(and(eq(files.topicId, input.topicId), eq(files.kind, input.kind)));
    return (row?.value ?? 0) + 1;
  }

  await tx.execute(sql`select id from sessions where id = ${input.sessionId} for update`);
  const [row] = await tx
    .select({ value: max(files.number) })
    .from(files)
    .where(
      and(eq(files.sessionId, input.sessionId), isNull(files.topicId), eq(files.kind, input.kind)),
    );
  return (row?.value ?? 0) + 1;
}

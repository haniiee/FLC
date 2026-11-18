import { describe, expect, it } from "vitest";
import { visibleFiles } from "./content-mappers";
import type { FileRow } from "../db/schema";

function row(partial: Partial<FileRow> & { status: FileRow["status"]; id: string }): FileRow {
  return {
    groupId: "g",
    sessionId: "s",
    topicId: null,
    kind: "audio",
    number: 1,
    title: null,
    storageKey: null,
    mimeType: "audio/mpeg",
    sizeBytes: 1,
    durationMs: null,
    textContent: null,
    processingError: null,
    source: "upload",
    uploadedBy: "u",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("visibleFiles", () => {
  const pending = row({ id: "p", status: "pending", number: 1 });
  const processing = row({ id: "x", status: "processing", number: 2 });
  const ready = row({ id: "r", status: "ready", number: 3 });
  const failed = row({ id: "f", status: "failed", number: 4 });
  const all = [pending, processing, ready, failed];

  it("never returns pending for managers", () => {
    const visible = visibleFiles(all, true);
    expect(visible.map((f) => f.status)).toEqual(["processing", "ready", "failed"]);
    expect(visible.some((f) => f.status === "pending")).toBe(false);
  });

  it("returns only ready for students", () => {
    expect(visibleFiles(all, false).map((f) => f.id)).toEqual(["r"]);
  });
});

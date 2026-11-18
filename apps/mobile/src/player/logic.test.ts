import { describe, expect, it } from "vitest";
import type { FileDto } from "@app/shared-types";
import {
  buildQueue,
  cycleRepeat,
  cycleSpeed,
  isAtEnd,
  shouldApplyResume,
  shouldResume,
  upNextItems,
} from "./logic";
import type { PlayerQueueItem } from "./types";

function file(
  partial: Partial<FileDto> & Pick<FileDto, "id" | "number" | "kind" | "status">,
): FileDto {
  return {
    groupId: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000002",
    topicId: "00000000-0000-4000-8000-000000000003",
    title: null,
    displayName: `Voice ${partial.number}`,
    mimeType: "audio/mpeg",
    sizeBytes: 1,
    durationMs: 1000,
    source: "upload",
    uploadedBy: "00000000-0000-4000-8000-000000000099",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function queueItem(id: string, name: string): PlayerQueueItem {
  return {
    fileId: id,
    displayName: name,
    topicDisplayName: "Topic 1",
    durationMs: 60_000,
    url: `https://x/${id}`,
    sessionDisplayName: "Session 1",
    groupDisplayName: "Class",
  };
}

describe("buildQueue", () => {
  it("keeps only ready audio and sorts by number", () => {
    const files = [
      file({ id: "b", number: 2, kind: "audio", status: "ready", displayName: "Voice 2" }),
      file({ id: "pdf", number: 1, kind: "pdf", status: "ready", displayName: "PDF 1" }),
      file({ id: "a", number: 1, kind: "audio", status: "ready", displayName: "Voice 1" }),
      file({ id: "c", number: 3, kind: "audio", status: "processing", displayName: "Voice 3" }),
    ];
    const queue = buildQueue(
      files,
      { sessionDisplayName: "Session 1", groupDisplayName: "Class", topicDisplayName: "Topic 1" },
      { a: "https://x/a", b: "https://x/b", c: "https://x/c" },
    );
    expect(queue.map((item) => item.fileId)).toEqual(["a", "b"]);
    expect(queue[0]?.displayName).toBe("Voice 1");
  });

  it("skips ready audio without a URL", () => {
    const files = [file({ id: "a", number: 1, kind: "audio", status: "ready" })];
    expect(buildQueue(files, { sessionDisplayName: "S", groupDisplayName: "G" }, {})).toEqual([]);
  });
});

describe("cycleRepeat", () => {
  it("cycles off → all → one → off", () => {
    expect(cycleRepeat("off")).toBe("all");
    expect(cycleRepeat("all")).toBe("one");
    expect(cycleRepeat("one")).toBe("off");
  });
});

describe("cycleSpeed", () => {
  it("cycles through supported rates", () => {
    expect(cycleSpeed(0.75)).toBe(1);
    expect(cycleSpeed(1)).toBe(1.25);
    expect(cycleSpeed(1.25)).toBe(1.5);
    expect(cycleSpeed(1.5)).toBe(2);
    expect(cycleSpeed(2)).toBe(0.75);
  });
});

describe("shouldResume", () => {
  it("requires pos > 5 and at least 5s remaining", () => {
    expect(shouldResume(4.9, 100)).toBe(false);
    expect(shouldResume(6, 100)).toBe(true);
    expect(shouldResume(96, 100)).toBe(false);
    expect(shouldResume(94.9, 100)).toBe(true);
  });
});

describe("shouldApplyResume", () => {
  it("is true only for user-start", () => {
    expect(shouldApplyResume("user-start")).toBe(true);
    expect(shouldApplyResume("auto")).toBe(false);
  });
});

describe("isAtEnd", () => {
  it("detects the last half-second of a track", () => {
    expect(isAtEnd(99.6, 100)).toBe(true);
    expect(isAtEnd(99.4, 100)).toBe(false);
    expect(isAtEnd(0, 0)).toBe(false);
  });
});

describe("upNextItems", () => {
  const queue = [queueItem("a", "Voice 1"), queueItem("b", "Voice 2"), queueItem("c", "Voice 3")];

  it("lists remaining tracks for repeat off", () => {
    const result = upNextItems(queue, 0, "off");
    expect(result.label).toBeNull();
    expect(result.rows.map((row) => row.item.fileId)).toEqual(["b", "c"]);
  });

  it("shows end-of-queue on the last track when repeat is off", () => {
    expect(upNextItems(queue, 2, "off")).toEqual({ rows: [], label: "end-of-queue" });
  });

  it("wraps to the start with repeats-from-start when repeat is all", () => {
    const result = upNextItems(queue, 2, "all");
    expect(result.label).toBe("repeats-from-start");
    expect(result.rows.map((row) => row.item.fileId)).toEqual(["a", "b"]);
    expect(result.rows.every((row) => row.fromWrap)).toBe(true);
  });

  it("shows repeating-this-track when repeat is one", () => {
    expect(upNextItems(queue, 1, "one")).toEqual({
      rows: [],
      label: "repeating-this-track",
    });
  });
});

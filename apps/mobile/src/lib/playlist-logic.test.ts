import { describe, expect, it } from "vitest";
import {
  buildPlaylistQueue,
  formatPlaylistSummary,
  moveDown,
  moveUp,
  type PlaylistQueueTrack,
} from "./playlist-logic";

function track(
  partial: Partial<PlaylistQueueTrack> & Pick<PlaylistQueueTrack, "fileId">,
): PlaylistQueueTrack {
  return {
    displayName: partial.displayName ?? partial.fileId,
    durationMs: partial.durationMs === undefined ? 1000 : partial.durationMs,
    url: partial.url === undefined ? `https://cdn.example/${partial.fileId}` : partial.url,
    sessionDisplayName: partial.sessionDisplayName ?? "Session 1",
    groupDisplayName: partial.groupDisplayName ?? "Class A",
    available: partial.available ?? true,
    ...partial,
  };
}

describe("buildPlaylistQueue", () => {
  const tracks = [
    track({
      fileId: "a",
      displayName: "Voice 1",
      available: false,
      url: undefined,
      durationMs: 9000,
    }),
    track({
      fileId: "b",
      displayName: "Voice 2",
      topicDisplayName: "Warmup",
      durationMs: 4000,
      groupDisplayName: "Class A",
      sessionDisplayName: "Session 1",
    }),
    track({
      fileId: "c",
      displayName: "Voice 3",
      available: true,
      url: undefined,
    }),
    track({
      fileId: "d",
      displayName: "Voice 4",
      durationMs: 2500,
      groupDisplayName: "Class B",
      sessionDisplayName: "Session 2",
      topicDisplayName: "Drills",
    }),
  ];

  it("drops unavailable voices and voices without a url, keeping playlist order", () => {
    const queue = buildPlaylistQueue(tracks);
    expect(queue.items.map((item) => item.fileId)).toEqual(["b", "d"]);
    expect(queue.startIndex).toBe(0);
    expect(queue.startFound).toBe(true);
    expect(queue.items[0]).toEqual({
      fileId: "b",
      displayName: "Voice 2",
      topicDisplayName: "Warmup",
      durationMs: 4000,
      url: "https://cdn.example/b",
      sessionDisplayName: "Session 1",
      groupDisplayName: "Class A",
    });
    expect(queue.items[1]).toMatchObject({
      fileId: "d",
      groupDisplayName: "Class B",
      sessionDisplayName: "Session 2",
      topicDisplayName: "Drills",
    });
  });

  it("counts startIndex only among playable voices before the tapped one", () => {
    const queue = buildPlaylistQueue(tracks, "d");
    expect(queue.startFound).toBe(true);
    expect(queue.startIndex).toBe(1);
    expect(queue.items[queue.startIndex]?.fileId).toBe("d");
  });

  it("does not start on an unavailable voice", () => {
    const missing = buildPlaylistQueue(tracks, "a");
    expect(missing.startFound).toBe(false);
    expect(missing.startIndex).toBe(0);
    expect(missing.items.map((item) => item.fileId)).toEqual(["b", "d"]);

    const noUrl = buildPlaylistQueue(tracks, "c");
    expect(noUrl.startFound).toBe(false);
    expect(noUrl.items.some((item) => item.fileId === "c")).toBe(false);
  });

  it("leaves the first and last playable voices as the repeat-all wrap ends", () => {
    const queue = buildPlaylistQueue(tracks);
    expect(queue.items[0]?.fileId).toBe("b");
    expect(queue.items[queue.items.length - 1]?.fileId).toBe("d");
  });
});

describe("moveUp / moveDown", () => {
  const ids = ["a", "b", "c"];

  it("swaps with the neighbor and stays put on the ends", () => {
    expect(moveUp(ids, 1)).toEqual(["b", "a", "c"]);
    expect(moveUp(ids, 0)).toEqual(["a", "b", "c"]);
    expect(moveDown(ids, 1)).toEqual(["a", "c", "b"]);
    expect(moveDown(ids, 2)).toEqual(["a", "b", "c"]);
    expect(moveUp(ids, -1)).toEqual(["a", "b", "c"]);
    expect(moveDown(ids, 3)).toEqual(["a", "b", "c"]);
  });
});

describe("formatPlaylistSummary", () => {
  it("formats singular, plural, and zero durations as N voices · mm:ss", () => {
    expect(formatPlaylistSummary(1, 5000)).toBe("1 voice · 0:05");
    expect(formatPlaylistSummary(2, 65000)).toBe("2 voices · 1:05");
    expect(formatPlaylistSummary(0, 0)).toBe("0 voices · 0:00");
    expect(formatPlaylistSummary(3, 90_000)).toBe("3 voices · 1:30");
  });
});

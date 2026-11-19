import { describe, expect, it } from "vitest";
import {
  filterBookmarks,
  formatBookmarkAt,
  isFileBookmarked,
  type BookmarkFilter,
} from "./bookmark-logic";

const items = [
  { fileId: "voice", kind: "audio" as const, positionMs: null },
  { fileId: "voice", kind: "audio" as const, positionMs: 42000 },
  { fileId: "pdf", kind: "pdf" as const, positionMs: null },
  { fileId: "image", kind: "image" as const, positionMs: null },
];

describe("formatBookmarkAt", () => {
  it("formats a moment as at m:ss", () => {
    expect(formatBookmarkAt(0)).toBe("at 0:00");
    expect(formatBookmarkAt(42_000)).toBe("at 0:42");
    expect(formatBookmarkAt(65_000)).toBe("at 1:05");
  });
});

describe("filterBookmarks", () => {
  it("keeps all, only voices, or only other files", () => {
    const cases: Array<[BookmarkFilter, string[]]> = [
      ["all", ["voice", "voice", "pdf", "image"]],
      ["voices", ["voice", "voice"]],
      ["files", ["pdf", "image"]],
    ];
    for (const [filter, ids] of cases) {
      expect(filterBookmarks(items, filter).map((item) => item.fileId)).toEqual(ids);
    }
  });
});

describe("isFileBookmarked", () => {
  it("is true only for a bookmark without a position", () => {
    expect(isFileBookmarked(items, "pdf")).toBe(true);
    expect(isFileBookmarked(items, "voice")).toBe(true);
    expect(isFileBookmarked([{ fileId: "voice", positionMs: 42000 }], "voice")).toBe(false);
    expect(isFileBookmarked(items, "missing")).toBe(false);
  });
});

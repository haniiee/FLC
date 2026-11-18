import { describe, expect, it } from "vitest";
import { STALE_PENDING_MS, isStalePending } from "./stale-pending";

describe("isStalePending", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");

  it("is false for a freshly created pending row", () => {
    expect(isStalePending(new Date("2026-11-18T11:59:00.000Z"), now)).toBe(false);
  });

  it("is true at exactly one hour old", () => {
    expect(isStalePending(new Date(now.getTime() - STALE_PENDING_MS), now)).toBe(true);
  });

  it("is true when older than one hour", () => {
    expect(isStalePending(new Date("2026-11-18T10:00:00.000Z"), now)).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(isStalePending(new Date("not-a-date"), now)).toBe(false);
  });
});

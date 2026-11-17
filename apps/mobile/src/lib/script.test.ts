import { describe, expect, it } from "vitest";
import { hasPersian } from "./script";

describe("hasPersian", () => {
  it("detects Persian script", () => {
    expect(hasPersian("کلاس تست")).toBe(true);
    expect(hasPersian("Hello کلاس")).toBe(true);
  });

  it("returns false for Latin-only", () => {
    expect(hasPersian("Session 1")).toBe(false);
    expect(hasPersian("ABC123")).toBe(false);
  });
});

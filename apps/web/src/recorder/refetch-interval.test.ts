import { describe, expect, it } from "vitest";
import { filesRefetchInterval } from "./refetch-interval";

describe("filesRefetchInterval", () => {
  it("returns 2000 when any file is processing", () => {
    expect(filesRefetchInterval([{ status: "ready" }, { status: "processing" }])).toBe(2000);
  });

  it("returns false when none are processing", () => {
    expect(filesRefetchInterval([{ status: "ready" }, { status: "failed" }])).toBe(false);
    expect(filesRefetchInterval([])).toBe(false);
  });
});

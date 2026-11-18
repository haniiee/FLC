import { describe, expect, it } from "vitest";
import { filesRefetchInterval } from "./files-refetch-interval";

describe("filesRefetchInterval", () => {
  it("polls every 2s while pending or processing", () => {
    expect(filesRefetchInterval([{ status: "ready" }, { status: "processing" }])).toBe(2000);
    expect(filesRefetchInterval([{ status: "pending" }])).toBe(2000);
  });

  it("stops when all files are settled", () => {
    expect(filesRefetchInterval([{ status: "ready" }, { status: "failed" }])).toBe(false);
    expect(filesRefetchInterval([])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { shouldReloadForRtl } from "./rtl";

describe("shouldReloadForRtl", () => {
  it("reloads once when runtime is still LTR after forceRTL", () => {
    expect(shouldReloadForRtl(false, false)).toBe(true);
  });

  it("does not reload when already RTL", () => {
    expect(shouldReloadForRtl(true, false)).toBe(false);
  });

  it("does not reload again after a prior reload", () => {
    expect(shouldReloadForRtl(false, true)).toBe(false);
  });
});

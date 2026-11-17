import { describe, expect, it } from "vitest";
import { persianHeadingMetrics } from "./persian-typography";

describe("persianHeadingMetrics", () => {
  it("expands lineHeight and clears letterSpacing for Persian headings", () => {
    expect(persianHeadingMetrics("display", true)).toEqual({
      lineHeight: 34 * 1.45,
      letterSpacing: 0,
    });
    expect(persianHeadingMetrics("h1", true)).toEqual({
      lineHeight: 28 * 1.45,
      letterSpacing: 0,
    });
    expect(persianHeadingMetrics("h2", true)).toEqual({
      lineHeight: 22 * 1.45,
      letterSpacing: 0,
    });
    expect(persianHeadingMetrics("h3", true)).toEqual({
      lineHeight: 18 * 1.45,
      letterSpacing: 0,
    });
  });

  it("returns null for Latin text or non-heading variants", () => {
    expect(persianHeadingMetrics("display", false)).toBeNull();
    expect(persianHeadingMetrics("body", true)).toBeNull();
    expect(persianHeadingMetrics("label", true)).toBeNull();
  });
});

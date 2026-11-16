import { describe, expect, it } from "vitest";
import { baseMimeType, pickRecordingMime } from "./pick-mime";

describe("pickRecordingMime", () => {
  it("prefers webm;codecs=opus when Chrome-like", () => {
    const supported = new Set(["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]);
    expect(pickRecordingMime((m) => supported.has(m))).toBe("audio/webm;codecs=opus");
  });

  it("falls back to audio/mp4 for Safari-like", () => {
    const supported = new Set(["audio/mp4"]);
    expect(pickRecordingMime((m) => supported.has(m))).toBe("audio/mp4");
  });

  it("returns null when nothing is supported", () => {
    expect(pickRecordingMime(() => false)).toBeNull();
  });

  it("strips codecs for base mime", () => {
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
  });
});

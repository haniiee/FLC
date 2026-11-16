import { describe, expect, it } from "vitest";
import { needsTranscode } from "./codecs";

describe("needsTranscode", () => {
  it("skips mp3 and aac", () => {
    expect(needsTranscode("mp3")).toBe(false);
    expect(needsTranscode("mp3float")).toBe(false);
    expect(needsTranscode("aac")).toBe(false);
    expect(needsTranscode("AAC")).toBe(false);
  });

  it("requires transcode for opus, vorbis, pcm", () => {
    expect(needsTranscode("opus")).toBe(true);
    expect(needsTranscode("vorbis")).toBe(true);
    expect(needsTranscode("pcm_s16le")).toBe(true);
    expect(needsTranscode("pcm_f32le")).toBe(true);
  });
});

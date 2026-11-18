import { fileDisplayName, sessionDisplayName, topicDisplayName } from "@app/shared-types";
import { describe, expect, it } from "vitest";

describe("display names (@app/shared-types)", () => {
  it("uses title when present", () => {
    expect(sessionDisplayName({ number: 1, title: "Grammar" })).toBe("Grammar");
    expect(topicDisplayName({ number: 2, title: "Intro" })).toBe("Intro");
    expect(fileDisplayName({ number: 3, title: "Lesson", kind: "audio" })).toBe("Lesson");
  });

  it("falls back to numbered labels", () => {
    expect(sessionDisplayName({ number: 1, title: null })).toBe("Session 1");
    expect(topicDisplayName({ number: 2, title: null })).toBe("Topic 2");
    expect(fileDisplayName({ number: 1, title: null, kind: "audio" })).toBe("Voice 1");
    expect(fileDisplayName({ number: 1, title: null, kind: "pdf" })).toBe("PDF 1");
    expect(fileDisplayName({ number: 1, title: null, kind: "image" })).toBe("Image 1");
    expect(fileDisplayName({ number: 1, title: null, kind: "video" })).toBe("Video 1");
    expect(fileDisplayName({ number: 1, title: null, kind: "text" })).toBe("Text 1");
  });
});

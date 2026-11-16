import { describe, expect, it } from "vitest";
import {
  cycleRepeatMode,
  resolveEndedIndex,
  resolveNextIndex,
  resolvePrevIndex,
  resolveResumePosition,
  resolveSeekOnLoad,
  shouldClearSavedPositionOnEnded,
  shouldClearSavedSessionOnEnded,
} from "./queue-logic";

describe("resolveEndedIndex", () => {
  it("repeat=one stays on current", () => {
    expect(resolveEndedIndex(1, 3, "one")).toBe(1);
  });

  it("advances to next item", () => {
    expect(resolveEndedIndex(0, 3, "off")).toBe(1);
    expect(resolveEndedIndex(1, 3, "all")).toBe(2);
  });

  it("at end with repeat=all wraps to 0", () => {
    expect(resolveEndedIndex(2, 3, "all")).toBe(0);
  });

  it("at end with repeat=off stops", () => {
    expect(resolveEndedIndex(2, 3, "off")).toBeNull();
  });
});

describe("resolveNextIndex", () => {
  it("goes to next when available", () => {
    expect(resolveNextIndex(0, 3, "off")).toBe(1);
  });

  it("wraps when repeat all/one", () => {
    expect(resolveNextIndex(2, 3, "all")).toBe(0);
    expect(resolveNextIndex(2, 3, "one")).toBe(0);
  });

  it("stops at end when off", () => {
    expect(resolveNextIndex(2, 3, "off")).toBeNull();
  });
});

describe("resolvePrevIndex", () => {
  it("goes to previous", () => {
    expect(resolvePrevIndex(2, 3, "off")).toBe(1);
  });

  it("at start with off stays at 0", () => {
    expect(resolvePrevIndex(0, 3, "off")).toBe(0);
  });

  it("at start with all/one wraps to last", () => {
    expect(resolvePrevIndex(0, 3, "all")).toBe(2);
    expect(resolvePrevIndex(0, 3, "one")).toBe(2);
  });
});

describe("resolveResumePosition", () => {
  it("returns saved position when enough time remains", () => {
    expect(resolveResumePosition(30, 120)).toBe(30);
  });

  it("restarts when less than 5 seconds remain", () => {
    expect(resolveResumePosition(118, 120)).toBe(0);
    expect(resolveResumePosition(116, 120)).toBe(0);
  });

  it("keeps saved when duration unknown", () => {
    expect(resolveResumePosition(42, 0)).toBe(42);
  });
});

describe("cycleRepeatMode", () => {
  it("cycles off → all → one → off", () => {
    expect(cycleRepeatMode("off")).toBe("all");
    expect(cycleRepeatMode("all")).toBe("one");
    expect(cycleRepeatMode("one")).toBe("off");
  });
});

describe("resolveSeekOnLoad", () => {
  it("auto-advance always starts at 0 even with saved position", () => {
    expect(resolveSeekOnLoad("auto-advance", 45, 120)).toBe(0);
    expect(resolveSeekOnLoad("auto-advance", 0, 120)).toBe(0);
  });

  it("user-play resumes from saved position", () => {
    expect(resolveSeekOnLoad("user-play", 45, 120)).toBe(45);
  });

  it("resume banner resumes from saved position", () => {
    expect(resolveSeekOnLoad("resume", 20, 90)).toBe(20);
  });

  it("user-play / resume restart near the end", () => {
    expect(resolveSeekOnLoad("user-play", 118, 120)).toBe(0);
    expect(resolveSeekOnLoad("resume", 117, 120)).toBe(0);
  });
});

describe("shouldClearSavedPositionOnEnded", () => {
  it("clears position when last item ends with repeat=off", () => {
    const nextIndex = resolveEndedIndex(2, 3, "off");
    expect(nextIndex).toBeNull();
    expect(shouldClearSavedPositionOnEnded("off", nextIndex)).toBe(true);
    expect(shouldClearSavedSessionOnEnded(nextIndex)).toBe(true);
  });

  it("clears position on every ended outcome", () => {
    expect(shouldClearSavedPositionOnEnded("one", 1)).toBe(true);
    expect(shouldClearSavedPositionOnEnded("all", 0)).toBe(true);
    expect(shouldClearSavedPositionOnEnded("off", 1)).toBe(true);
  });

  it("keeps session storage when advancing / looping", () => {
    expect(shouldClearSavedSessionOnEnded(resolveEndedIndex(0, 3, "off"))).toBe(false);
    expect(shouldClearSavedSessionOnEnded(resolveEndedIndex(2, 3, "all"))).toBe(false);
    expect(shouldClearSavedSessionOnEnded(resolveEndedIndex(1, 3, "one"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  CANCEL_SLIDE_PX,
  MAX_RECORD_MS,
  MIN_RECORD_MS,
  clampMaxDuration,
  formatRecTimer,
  hasRoomToCancel,
  isCancelGesture,
  decideRecordingStart,
  nextVoiceTitle,
  resolveStartOutcome,
  screenLeftDx,
  shouldDiscard,
} from "./record-logic";

describe("shouldDiscard", () => {
  it("discards under 1 second", () => {
    expect(shouldDiscard(0)).toBe(true);
    expect(shouldDiscard(MIN_RECORD_MS - 1)).toBe(true);
  });

  it("keeps recordings at or above 1 second", () => {
    expect(shouldDiscard(MIN_RECORD_MS)).toBe(false);
    expect(shouldDiscard(4_000)).toBe(false);
  });
});

describe("isCancelGesture", () => {
  it("cancels when slid left past threshold", () => {
    expect(isCancelGesture(-CANCEL_SLIDE_PX)).toBe(true);
    expect(isCancelGesture(-CANCEL_SLIDE_PX - 20)).toBe(true);
  });

  it("does not cancel for smaller or rightward slides", () => {
    expect(isCancelGesture(-(CANCEL_SLIDE_PX - 1))).toBe(false);
    expect(isCancelGesture(0)).toBe(false);
    expect(isCancelGesture(CANCEL_SLIDE_PX)).toBe(false);
  });
});

describe("formatRecTimer", () => {
  it("formats m:ss", () => {
    expect(formatRecTimer(0)).toBe("0:00");
    expect(formatRecTimer(999)).toBe("0:00");
    expect(formatRecTimer(1_000)).toBe("0:01");
    expect(formatRecTimer(61_000)).toBe("1:01");
    expect(formatRecTimer(600_000)).toBe("10:00");
  });
});

describe("clampMaxDuration", () => {
  it("caps at 10 minutes and floors invalid values", () => {
    expect(clampMaxDuration(0)).toBe(0);
    expect(clampMaxDuration(4_000)).toBe(4_000);
    expect(clampMaxDuration(MAX_RECORD_MS + 5_000)).toBe(MAX_RECORD_MS);
    expect(clampMaxDuration(-10)).toBe(0);
    expect(clampMaxDuration(Number.NaN)).toBe(0);
  });
});

describe("screenLeftDx", () => {
  it("flips translation under RTL so screen-left stays negative", () => {
    expect(screenLeftDx(-90, false)).toBe(-90);
    expect(screenLeftDx(90, true)).toBe(-90);
    expect(screenLeftDx(-90, true)).toBe(90);
  });
});

describe("hasRoomToCancel", () => {
  it("end-placed button (center ≈ screenWidth - 40) has room for the threshold", () => {
    const screenWidth = 1080;
    const endCenterX = screenWidth - 40;
    expect(hasRoomToCancel(endCenterX, CANCEL_SLIDE_PX)).toBe(true);
    expect(endCenterX).toBeGreaterThan(CANCEL_SLIDE_PX);
  });

  it("start-placed button near the left edge does not have room", () => {
    expect(hasRoomToCancel(40, CANCEL_SLIDE_PX)).toBe(false);
    expect(hasRoomToCancel(CANCEL_SLIDE_PX - 1, CANCEL_SLIDE_PX)).toBe(false);
  });
});

describe("nextVoiceTitle", () => {
  it("uses max audio number + 1", () => {
    expect(nextVoiceTitle([])).toBe("Voice 1");
    expect(
      nextVoiceTitle([
        { kind: "audio", number: 1 },
        { kind: "audio", number: 2 },
        { kind: "pdf", number: 1 },
      ]),
    ).toBe("Voice 3");
  });

  it("ignores pending audio and fills gaps from the highest number", () => {
    const files = [
      ...Array.from({ length: 19 }, (_, index) => ({
        kind: "audio",
        status: "ready",
        number: index + 1,
      })),
      { kind: "audio", status: "pending", number: 99 },
      { kind: "audio", status: "ready", number: 22 },
      { kind: "audio", status: "failed", number: 23 },
      { kind: "pdf", status: "ready", number: 40 },
    ];
    expect(nextVoiceTitle(files)).toBe("Voice 24");
  });

  it("reads Voice N from displayName when number is absent", () => {
    expect(
      nextVoiceTitle([
        { kind: "audio", status: "ready", displayName: "Voice 22" },
        { kind: "audio", status: "ready", displayName: "Lesson" },
        { kind: "audio", status: "ready", number: 23 },
      ]),
    ).toBe("Voice 24");
  });
});

describe("decideRecordingStart", () => {
  const idle = { starting: false, stopping: false, active: false, finishing: false };

  it("allows a start when the recorder is idle", () => {
    expect(decideRecordingStart(idle)).toBe("start");
  });

  it("toasts instead of starting while a stop or abort is still running", () => {
    expect(decideRecordingStart({ ...idle, stopping: true })).toBe("toast");
    expect(decideRecordingStart({ ...idle, stopping: true, starting: true })).toBe("toast");
    expect(decideRecordingStart({ ...idle, stopping: true, active: true, finishing: true })).toBe(
      "toast",
    );
  });

  it("ignores a new hold while starting, recording, or finishing", () => {
    expect(decideRecordingStart({ ...idle, starting: true })).toBe("ignore");
    expect(decideRecordingStart({ ...idle, active: true })).toBe("ignore");
    expect(decideRecordingStart({ ...idle, finishing: true })).toBe("ignore");
  });
});

describe("resolveStartOutcome", () => {
  it("aborts before start when this gesture was released", () => {
    expect(
      resolveStartOutcome({
        gestureId: 1,
        currentGestureId: 1,
        releasedId: 1,
        started: false,
      }),
    ).toBe("abort_before_start");
  });

  it("aborts when a newer gesture takes over mid-start", () => {
    expect(
      resolveStartOutcome({
        gestureId: 1,
        currentGestureId: 2,
        releasedId: 0,
        started: false,
      }),
    ).toBe("abort_before_start");
    expect(
      resolveStartOutcome({
        gestureId: 1,
        currentGestureId: 2,
        releasedId: 1,
        started: true,
      }),
    ).toBe("abort_after_start");
  });

  it("continues while the same gesture is still held", () => {
    expect(
      resolveStartOutcome({
        gestureId: 3,
        currentGestureId: 3,
        releasedId: 2,
        started: false,
      }),
    ).toBe("continue");
    expect(
      resolveStartOutcome({
        gestureId: 3,
        currentGestureId: 3,
        releasedId: 0,
        started: true,
      }),
    ).toBe("continue");
  });
});

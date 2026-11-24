import { describe, expect, it } from "vitest";
import { copy } from "../lib/copy";
import {
  CANCEL_THRESHOLD_PX,
  cancelHint,
  initialGestureState,
  isCancelGesture,
  MAX_RECORD_MS,
  MIN_RECORD_MS,
  reduceGesture,
  type GestureState,
} from "./gesture";

function withPerm(state: GestureState = initialGestureState): GestureState {
  return { ...state, hasPermission: true };
}

describe("isCancelGesture", () => {
  it("arms cancel to the right in rtl", () => {
    expect(isCancelGesture(CANCEL_THRESHOLD_PX, "rtl")).toBe(true);
    expect(isCancelGesture(CANCEL_THRESHOLD_PX - 1, "rtl")).toBe(false);
    expect(isCancelGesture(-CANCEL_THRESHOLD_PX, "rtl")).toBe(false);
  });

  it("arms cancel to the left in ltr", () => {
    expect(isCancelGesture(-CANCEL_THRESHOLD_PX, "ltr")).toBe(true);
    expect(isCancelGesture(-(CANCEL_THRESHOLD_PX - 1), "ltr")).toBe(false);
    expect(isCancelGesture(CANCEL_THRESHOLD_PX, "ltr")).toBe(false);
  });
});

describe("cancelHint", () => {
  it("points toward cancel direction", () => {
    expect(cancelHint("rtl")).toBe(copy.recorder.slideCancelRtl);
    expect(cancelHint("ltr")).toBe(copy.recorder.slideCancelLtr);
  });
});

describe("reduceGesture", () => {
  it("first press without permission only requests mic", () => {
    const { state, effects } = reduceGesture(initialGestureState, {
      type: "press",
      x: 10,
      now: 0,
    });
    expect(state.ui).toBe("requesting-permission");
    expect(effects.some((e) => e.type === "request-permission")).toBe(true);
    expect(effects.some((e) => e.type === "start-recording")).toBe(false);
  });

  it("permission-granted returns to idle with toast", () => {
    const requesting = reduceGesture(initialGestureState, {
      type: "press",
      x: 0,
      now: 0,
    }).state;
    const { state, effects } = reduceGesture(requesting, { type: "permission-granted" });
    expect(state.ui).toBe("idle");
    expect(state.hasPermission).toBe(true);
    expect(effects).toContainEqual({ type: "toast", message: copy.recorder.holdAgain });
  });

  it("discards recordings shorter than 1s", () => {
    const start = reduceGesture(withPerm(), { type: "press", x: 0, now: 1000 });
    expect(start.state.ui).toBe("recording");
    const { state, effects } = reduceGesture(start.state, {
      type: "release",
      now: 1000 + MIN_RECORD_MS - 1,
    });
    expect(state.ui).toBe("idle");
    expect(effects.some((e) => e.type === "stop-and-discard")).toBe(true);
    expect(effects).toContainEqual({
      type: "toast",
      message: copy.recorder.holdToRecordHint,
    });
  });

  it("cancel-armed release discards without short toast", () => {
    let state = reduceGesture(withPerm(), { type: "press", x: 100, now: 0 }).state;
    state = reduceGesture(state, {
      type: "move",
      x: 100 + CANCEL_THRESHOLD_PX,
      dir: "rtl",
    }).state;
    expect(state.ui).toBe("cancel-armed");
    const released = reduceGesture(state, { type: "release", now: 5000 });
    expect(released.state.ui).toBe("idle");
    expect(released.effects).toContainEqual({
      type: "stop-and-discard",
      reason: "cancelled",
    });
  });

  it("auto-sends at 10 minute ceiling", () => {
    const start = reduceGesture(withPerm(), { type: "press", x: 0, now: 0 });
    const { state, effects } = reduceGesture(start.state, {
      type: "tick",
      now: MAX_RECORD_MS,
    });
    expect(state.ui).toBe("sending");
    expect(effects.some((e) => e.type === "stop-and-send")).toBe(true);
  });

  it("release after long enough sends", () => {
    const start = reduceGesture(withPerm(), { type: "press", x: 0, now: 0 });
    const { state, effects } = reduceGesture(start.state, {
      type: "release",
      now: MIN_RECORD_MS + 50,
    });
    expect(state.ui).toBe("sending");
    expect(effects.some((e) => e.type === "stop-and-send")).toBe(true);
  });
});

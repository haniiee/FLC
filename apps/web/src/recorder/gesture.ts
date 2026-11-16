export const CANCEL_THRESHOLD_PX = 80;
export const MIN_RECORD_MS = 1_000;
export const MAX_RECORD_MS = 10 * 60_000;

export type Dir = "rtl" | "ltr";

export type RecorderUiState =
  "idle" | "requesting-permission" | "recording" | "cancel-armed" | "sending";

export type GestureState = {
  ui: RecorderUiState;
  hasPermission: boolean;
  startedAt: number | null;
  elapsedMs: number;
  startX: number | null;
};

export type GestureEvent =
  | { type: "press"; x: number; now: number }
  | { type: "permission-granted" }
  | { type: "permission-denied" }
  | { type: "move"; x: number; dir: Dir }
  | { type: "release"; now: number }
  | { type: "tick"; now: number }
  | { type: "send-finished" };

export type GestureEffect =
  | { type: "request-permission" }
  | { type: "toast"; message: string }
  | { type: "start-recording" }
  | { type: "vibrate" }
  | { type: "stop-and-send" }
  | { type: "stop-and-discard"; reason: "too-short" | "cancelled" };

export const initialGestureState: GestureState = {
  ui: "idle",
  hasPermission: false,
  startedAt: null,
  elapsedMs: 0,
  startX: null,
};

/** Cancel when dragged toward cancel side: right in RTL, left in LTR. */
export function isCancelGesture(dx: number, dir: Dir): boolean {
  if (dir === "rtl") {
    return dx >= CANCEL_THRESHOLD_PX;
  }
  return dx <= -CANCEL_THRESHOLD_PX;
}

export function cancelHint(dir: Dir): string {
  // RTL cancel is swipe-right →; LTR cancel is swipe-left ←
  return dir === "rtl" ? "برای لغو بکش →" : "برای لغو بکش ←";
}

export function reduceGesture(
  state: GestureState,
  event: GestureEvent,
): { state: GestureState; effects: GestureEffect[] } {
  const effects: GestureEffect[] = [];

  switch (event.type) {
    case "press": {
      if (state.ui !== "idle") {
        return { state, effects };
      }
      if (!state.hasPermission) {
        effects.push({ type: "request-permission" });
        return {
          state: { ...state, ui: "requesting-permission", startX: event.x },
          effects,
        };
      }
      effects.push({ type: "start-recording" }, { type: "vibrate" });
      return {
        state: {
          ...state,
          ui: "recording",
          startedAt: event.now,
          elapsedMs: 0,
          startX: event.x,
        },
        effects,
      };
    }

    case "permission-granted": {
      if (state.ui !== "requesting-permission") {
        return { state: { ...state, hasPermission: true }, effects };
      }
      effects.push({ type: "toast", message: "حالا دوباره نگه دار" });
      return {
        state: {
          ...state,
          ui: "idle",
          hasPermission: true,
          startX: null,
          startedAt: null,
          elapsedMs: 0,
        },
        effects,
      };
    }

    case "permission-denied": {
      if (state.ui !== "requesting-permission") {
        return { state, effects };
      }
      effects.push({ type: "toast", message: "دسترسی میکروفن لازم است" });
      return {
        state: {
          ...state,
          ui: "idle",
          hasPermission: false,
          startX: null,
        },
        effects,
      };
    }

    case "move": {
      if (state.ui !== "recording" && state.ui !== "cancel-armed") {
        return { state, effects };
      }
      if (state.startX === null) {
        return { state, effects };
      }
      const dx = event.x - state.startX;
      const cancel = isCancelGesture(dx, event.dir);
      if (cancel && state.ui === "recording") {
        return { state: { ...state, ui: "cancel-armed" }, effects };
      }
      if (!cancel && state.ui === "cancel-armed") {
        return { state: { ...state, ui: "recording" }, effects };
      }
      return { state, effects };
    }

    case "release": {
      if (state.ui === "cancel-armed") {
        effects.push({ type: "stop-and-discard", reason: "cancelled" });
        return {
          state: {
            ...state,
            ui: "idle",
            startedAt: null,
            elapsedMs: 0,
            startX: null,
          },
          effects,
        };
      }
      if (state.ui !== "recording") {
        return { state, effects };
      }
      const elapsed =
        state.startedAt !== null ? Math.max(state.elapsedMs, event.now - state.startedAt) : 0;
      if (elapsed < MIN_RECORD_MS) {
        effects.push(
          { type: "stop-and-discard", reason: "too-short" },
          { type: "toast", message: "برای ضبط، دکمه رو نگه دار" },
        );
        return {
          state: {
            ...state,
            ui: "idle",
            startedAt: null,
            elapsedMs: 0,
            startX: null,
          },
          effects,
        };
      }
      effects.push({ type: "stop-and-send" });
      return {
        state: {
          ...state,
          ui: "sending",
          elapsedMs: elapsed,
          startedAt: null,
          startX: null,
        },
        effects,
      };
    }

    case "tick": {
      if (state.ui !== "recording" && state.ui !== "cancel-armed") {
        return { state, effects };
      }
      if (state.startedAt === null) {
        return { state, effects };
      }
      const elapsed = event.now - state.startedAt;
      if (elapsed >= MAX_RECORD_MS) {
        effects.push({ type: "stop-and-send" });
        return {
          state: {
            ...state,
            ui: "sending",
            elapsedMs: MAX_RECORD_MS,
            startedAt: null,
            startX: null,
          },
          effects,
        };
      }
      return { state: { ...state, elapsedMs: elapsed }, effects };
    }

    case "send-finished": {
      return {
        state: {
          ...state,
          ui: "idle",
          startedAt: null,
          elapsedMs: 0,
          startX: null,
        },
        effects,
      };
    }

    default:
      return { state, effects };
  }
}

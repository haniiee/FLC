export const MIN_RECORD_MS = 1_000;
export const CANCEL_SLIDE_PX = 80;
export const MAX_RECORD_MS = 10 * 60 * 1_000;

/** Discard taps / accidental presses shorter than 1s. */
export function shouldDiscard(durationMs: number): boolean {
  return durationMs < MIN_RECORD_MS;
}

/**
 * Slide left past the cancel threshold.
 * `dx` must be screen-relative: negative = left (callers should flip RNGH
 * translationX under RTL so left stays negative).
 */
export function isCancelGesture(dx: number): boolean {
  return dx <= -CANCEL_SLIDE_PX;
}

/** Map gesture translationX so negative always means screen-left. */
export function screenLeftDx(translationX: number, isRTL: boolean): number {
  return isRTL ? -translationX : translationX;
}

/** Format elapsed recording time as `m:ss`. */
export function formatRecTimer(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Cap duration at the 10-minute recording ceiling. */
export function clampMaxDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(ms, MAX_RECORD_MS);
}

/** Map expo-audio metering (dB, typically ~-160..0) to a 0..1 level bar. */
export function meteringToLevel(metering: number | undefined): number {
  if (metering == null || !Number.isFinite(metering)) return 0.18;
  return Math.max(0, Math.min(1, (metering + 50) / 50));
}

/**
 * True when the finger can travel left from the button center to the screen
 * edge by at least `threshold` (e.g. CANCEL_SLIDE_PX) before hitting x=0.
 */
export function hasRoomToCancel(buttonCenterX: number, threshold: number): boolean {
  if (!Number.isFinite(buttonCenterX) || !Number.isFinite(threshold)) return false;
  return buttonCenterX >= threshold;
}

const VOICE_TITLE = /^Voice (\d+)$/;

type VoiceTitleSource = {
  kind: string;
  status?: string;
  number?: number | null;
  displayName?: string | null;
};

/** Highest non-pending audio number, preferring `number` over a `Voice N` title. */
function audioOrdinal(file: VoiceTitleSource): number | null {
  if (file.kind !== "audio" || file.status === "pending") return null;
  if (typeof file.number === "number" && Number.isFinite(file.number)) return file.number;
  const match = file.displayName?.match(VOICE_TITLE);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Predicted auto title for the next voice (max non-pending audio number + 1). */
export function nextVoiceTitle(files: ReadonlyArray<VoiceTitleSource>): string {
  let maxNumber = 0;
  for (const file of files) {
    const ordinal = audioOrdinal(file);
    if (ordinal != null && ordinal > maxNumber) maxNumber = ordinal;
  }
  return `Voice ${maxNumber + 1}`;
}

export type RecorderActivity = {
  starting: boolean;
  stopping: boolean;
  active: boolean;
  finishing: boolean;
};

export type StartDecision = "start" | "toast" | "ignore";

/**
 * Whether a new hold may call beginRecording.
 * A stop/abort still in flight must not overlap the next prepare.
 */
export function decideRecordingStart(activity: RecorderActivity): StartDecision {
  if (activity.stopping) return "toast";
  if (activity.starting || activity.active || activity.finishing) return "ignore";
  return "start";
}

export type StartOutcome = "continue" | "abort_before_start" | "abort_after_start";

/**
 * Decide how beginRecording should finish after an await.
 * A gesture is stale when it was released, or a newer gesture has taken over.
 */
export function resolveStartOutcome(input: {
  gestureId: number;
  currentGestureId: number;
  releasedId: number;
  started: boolean;
}): StartOutcome {
  const stale = input.releasedId >= input.gestureId || input.currentGestureId !== input.gestureId;
  if (!stale) return "continue";
  return input.started ? "abort_after_start" : "abort_before_start";
}

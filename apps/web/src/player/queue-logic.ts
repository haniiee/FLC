import type { RepeatMode } from "./types";

/** Next index for ended event. `null` means stop. Same index for repeat=one (caller seeks 0). */
export function resolveEndedIndex(
  currentIndex: number,
  length: number,
  repeatMode: RepeatMode,
): number | null {
  if (length <= 0) {
    return null;
  }
  if (repeatMode === "one") {
    return currentIndex;
  }
  const next = currentIndex + 1;
  if (next < length) {
    return next;
  }
  if (repeatMode === "all") {
    return 0;
  }
  return null;
}

/** Next track from user action (wraps only when repeat=all). */
export function resolveNextIndex(
  currentIndex: number,
  length: number,
  repeatMode: RepeatMode,
): number | null {
  if (length <= 0) {
    return null;
  }
  const next = currentIndex + 1;
  if (next < length) {
    return next;
  }
  if (repeatMode === "all" || repeatMode === "one") {
    return 0;
  }
  return null;
}

/** Previous track (wraps to last when at 0 and repeat is not off). */
export function resolvePrevIndex(
  currentIndex: number,
  length: number,
  repeatMode: RepeatMode,
): number | null {
  if (length <= 0) {
    return null;
  }
  if (currentIndex > 0) {
    return currentIndex - 1;
  }
  if (repeatMode === "all" || repeatMode === "one") {
    return length - 1;
  }
  return 0;
}

/**
 * Resume position in seconds. If less than 5s remain until the end, start from 0.
 * `durationSec` may be 0/unknown — then return saved as-is (clamped >= 0).
 */
export function resolveResumePosition(savedSec: number, durationSec: number): number {
  const saved = Number.isFinite(savedSec) ? Math.max(0, savedSec) : 0;
  if (!durationSec || durationSec <= 0) {
    return saved;
  }
  if (durationSec - saved < 5) {
    return 0;
  }
  return Math.min(saved, durationSec);
}

/**
 * Seek target when loading a queue item.
 * - `user-play` / `resume`: use saved position (with near-end reset)
 * - `auto-advance`: always start at 0 (ended / next / loop)
 */
export function resolveSeekOnLoad(
  reason: "user-play" | "resume" | "auto-advance",
  savedSec: number,
  durationSec: number,
): number {
  if (reason === "auto-advance") {
    return 0;
  }
  return resolveResumePosition(savedSec, durationSec);
}

export function cycleRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === "off") {
    return "all";
  }
  if (mode === "all") {
    return "one";
  }
  return "off";
}

/**
 * After a track ends, always clear `flc:pos:{fileId}`.
 * When the queue stops (`nextIndex === null`, e.g. last item + repeat=off),
 * also clear `flc:player:session` so no resume banner remains.
 */
export function shouldClearSavedPositionOnEnded(
  _repeatMode: RepeatMode,
  _nextIndex: number | null,
): boolean {
  return true;
}

/** Clear resume session storage when ended resolves to stop (no next track). */
export function shouldClearSavedSessionOnEnded(nextIndex: number | null): boolean {
  return nextIndex === null;
}

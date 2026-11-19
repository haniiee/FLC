import type { FileDto } from "@app/shared-types";
import { PLAYBACK_RATES, type PlaybackRate, type PlayerQueueItem, type RepeatMode } from "./types";

/** Ready audio files sorted by `number` ascending. */
export function buildQueue(
  files: FileDto[],
  meta: {
    sessionDisplayName: string;
    groupDisplayName: string;
    topicDisplayName?: string;
  },
  urlsByFileId: Record<string, string>,
): PlayerQueueItem[] {
  return files
    .filter((file) => file.kind === "audio" && file.status === "ready")
    .slice()
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .flatMap((file) => {
      const url = urlsByFileId[file.id];
      if (!url) return [];
      return [
        {
          fileId: file.id,
          displayName: file.displayName ?? "",
          topicDisplayName: meta.topicDisplayName,
          durationMs: file.durationMs,
          url,
          sessionDisplayName: meta.sessionDisplayName,
          groupDisplayName: meta.groupDisplayName,
        } satisfies PlayerQueueItem,
      ];
    });
}

export function cycleRepeat(mode: RepeatMode): RepeatMode {
  if (mode === "off") return "all";
  if (mode === "all") return "one";
  return "off";
}

export function cycleSpeed(rate: number): PlaybackRate {
  const index = PLAYBACK_RATES.findIndex((value) => Math.abs(value - rate) < 0.001);
  if (index === -1) return PLAYBACK_RATES[0];
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]!;
}

/** Saved rates that are no longer in the list fall back to 1×. */
export function normalizePlaybackRate(value: number): PlaybackRate {
  if ((PLAYBACK_RATES as readonly number[]).includes(value)) return value as PlaybackRate;
  return 1;
}

export const DEFAULT_REPEAT_MODE: RepeatMode = "all";

/** Missing or unknown storage falls back to repeat-all. */
export function normalizeRepeatMode(raw: string | null | undefined): RepeatMode {
  if (raw === "off" || raw === "all" || raw === "one") return raw;
  return DEFAULT_REPEAT_MODE;
}

/**
 * Skip target in seconds. Never before 0, and never into the last half-second
 * so a forward skip cannot trip end-of-track.
 */
export function clampSkipPosition(position: number, deltaSec: number, duration: number): number {
  const pos = Number.isFinite(position) ? position : 0;
  const delta = Number.isFinite(deltaSec) ? deltaSec : 0;
  const next = pos + delta;
  const max = Number.isFinite(duration) && duration > 0.5 ? duration - 0.5 : 0;
  return Math.min(Math.max(0, next), Math.max(0, max));
}

export type TransportCursor = {
  index: number;
  positionSec: number;
  queueLength: number;
  repeat: RepeatMode;
  /** True when this step changes the track. */
  moved: boolean;
  /** True when this step stays on the track and seeks to 0. */
  restart: boolean;
};

/**
 * One previous/next step. `index` is the caller's ref, so a burst of taps
 * does not reuse a stale playlist index. A restart writes position 0 so the
 * next tap moves tracks instead of restarting again.
 */
export function stepTransport(
  cursor: Pick<TransportCursor, "index" | "positionSec" | "queueLength" | "repeat">,
  direction: "previous" | "next",
): TransportCursor {
  const base = {
    index: cursor.index,
    positionSec: cursor.positionSec,
    queueLength: cursor.queueLength,
    repeat: cursor.repeat,
  };
  if (cursor.queueLength <= 0) return { ...base, moved: false, restart: false };

  if (direction === "previous") {
    const action = previousAction({
      positionSec: cursor.positionSec,
      index: cursor.index,
      queueLength: cursor.queueLength,
      repeat: cursor.repeat,
    });
    if (action === "restart") return { ...base, positionSec: 0, moved: false, restart: true };
    if (action === "wrap-to-last") {
      return {
        ...base,
        index: cursor.queueLength - 1,
        positionSec: 0,
        moved: true,
        restart: false,
      };
    }
    return { ...base, index: cursor.index - 1, positionSec: 0, moved: true, restart: false };
  }

  if (cursor.index < cursor.queueLength - 1) {
    return { ...base, index: cursor.index + 1, positionSec: 0, moved: true, restart: false };
  }
  if (cursor.repeat === "all") {
    const same = cursor.index === 0;
    return { ...base, index: 0, positionSec: 0, moved: !same, restart: same };
  }
  return { ...base, moved: false, restart: false };
}

export type PreviousAction = "restart" | "previous" | "wrap-to-last";

/** Past 3s restarts the track. The first track wraps to the end only when repeat is all. */
export function previousAction(input: {
  positionSec: number;
  index: number;
  queueLength: number;
  repeat: RepeatMode;
}): PreviousAction {
  if (input.positionSec > 3) return "restart";
  if (input.index > 0) return "previous";
  if (input.repeat === "all" && input.queueLength > 1) return "wrap-to-last";
  return "restart";
}

/**
 * Resume when saved position is past 5s and at least 5s remain before the end.
 * Durations/positions are in seconds.
 */
export function shouldResume(pos: number, duration: number): boolean {
  if (!Number.isFinite(pos) || pos <= 5) return false;
  if (!Number.isFinite(duration) || duration <= 0) return pos > 5;
  return pos < duration - 5;
}

/** Only explicit user starts (FileRow play / Up next tap) may apply resume. */
export type ResumeTrigger = "user-start" | "auto";

export function shouldApplyResume(trigger: ResumeTrigger): boolean {
  return trigger === "user-start";
}

/** True when playback is at (or past) the end of the track. */
export function isAtEnd(pos: number, duration: number): boolean {
  if (!Number.isFinite(pos) || !Number.isFinite(duration) || duration <= 0) return false;
  return pos >= duration - 0.5;
}

/** True when within the last `marginSec` of the track (default 5s). */
export function isNearEnd(pos: number, duration: number, marginSec = 5): boolean {
  if (!Number.isFinite(pos) || !Number.isFinite(duration) || duration <= 0) return false;
  return pos >= duration - marginSec;
}

/** Whether a position should be written to resume storage. */
export function shouldPersistResume(pos: number, duration: number): boolean {
  if (!Number.isFinite(pos) || pos <= 0) return false;
  if (!Number.isFinite(duration) || duration <= 0) return true;
  return pos < duration - 5;
}

export type UpNextRow = {
  item: PlayerQueueItem;
  index: number;
  number: number;
  fromWrap: boolean;
};

export type UpNextResult = {
  rows: UpNextRow[];
  /** Empty-state / section label when there are no normal upcoming rows. */
  label: "end-of-queue" | "repeating-this-track" | "repeats-from-start" | null;
};

/**
 * Builds the Up next list, including wrap-around rows when repeat=all
 * on the last track, and a repeating label when repeat=one.
 */
export function upNextItems(
  queue: PlayerQueueItem[],
  index: number,
  repeat: RepeatMode,
): UpNextResult {
  if (queue.length === 0 || index < 0 || index >= queue.length) {
    return { rows: [], label: "end-of-queue" };
  }

  if (repeat === "one") {
    return { rows: [], label: "repeating-this-track" };
  }

  const upcoming = queue.slice(index + 1).map((item, offset) => ({
    item,
    index: index + 1 + offset,
    number: index + 2 + offset,
    fromWrap: false,
  }));

  if (upcoming.length > 0) {
    return { rows: upcoming, label: null };
  }

  if (repeat === "all") {
    const wrapped = queue.slice(0, index).map((item, i) => ({
      item,
      index: i,
      number: i + 1,
      fromWrap: true,
    }));
    return {
      rows: wrapped,
      label: wrapped.length > 0 ? "repeats-from-start" : "end-of-queue",
    };
  }

  return { rows: [], label: "end-of-queue" };
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function albumTitleFor(item: PlayerQueueItem): string {
  if (item.topicDisplayName) {
    return `${item.sessionDisplayName} · ${item.topicDisplayName}`;
  }
  return item.sessionDisplayName;
}

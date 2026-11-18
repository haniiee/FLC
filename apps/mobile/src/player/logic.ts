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
    .sort((a, b) => a.number - b.number)
    .flatMap((file) => {
      const url = urlsByFileId[file.id];
      if (!url) return [];
      return [
        {
          fileId: file.id,
          displayName: file.displayName,
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

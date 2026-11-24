import type { PlayerQueueItem } from "../player/types";

export type PlaylistQueueTrack = {
  fileId: string;
  displayName: string;
  topicDisplayName?: string;
  durationMs: number | null;
  url?: string;
  sessionDisplayName: string;
  groupDisplayName: string;
  available: boolean;
};

export const playlistsQueryKey = ["playlists"] as const;

export function playlistQueryKey(id: string) {
  return ["playlist", id] as const;
}

export function buildPlaylistQueue(
  tracks: readonly PlaylistQueueTrack[],
  startFileId?: string,
): { items: PlayerQueueItem[]; startIndex: number; startFound: boolean } {
  const items: PlayerQueueItem[] = [];
  let startIndex = 0;
  let startFound = startFileId == null;

  for (const track of tracks) {
    if (!track.available || !track.url) continue;
    if (!startFound && track.fileId === startFileId) {
      startIndex = items.length;
      startFound = true;
    }
    const item: PlayerQueueItem = {
      fileId: track.fileId,
      displayName: track.displayName,
      durationMs: track.durationMs,
      url: track.url,
      sessionDisplayName: track.sessionDisplayName,
      groupDisplayName: track.groupDisplayName,
    };
    if (track.topicDisplayName) {
      item.topicDisplayName = track.topicDisplayName;
    }
    items.push(item);
  }

  if (!startFound || items.length === 0) {
    startIndex = 0;
  }

  return { items, startIndex, startFound };
}

function moveBy<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items.slice();
  }
  const next = items.slice();
  const current = next[index]!;
  next[index] = next[target]!;
  next[target] = current;
  return next;
}

export function moveUp<T>(items: readonly T[], index: number): T[] {
  return moveBy(items, index, -1);
}

export function moveDown<T>(items: readonly T[], index: number): T[] {
  return moveBy(items, index, 1);
}

export function formatPlaylistClock(totalDurationMs: number): string {
  const safe = Number.isFinite(totalDurationMs) ? Math.max(0, totalDurationMs) : 0;
  const totalSec = Math.round(safe / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatPlaylistSummary(count: number, totalDurationMs: number): string {
  const voices = count === 1 ? "1 voice" : `${count} voices`;
  return `${voices} · ${formatPlaylistClock(totalDurationMs)}`;
}

export function playlistTrackSubtitle(input: {
  groupDisplayName: string;
  sessionDisplayName: string;
  topicDisplayName?: string | null;
}): string {
  const parts = [input.groupDisplayName, input.sessionDisplayName];
  if (input.topicDisplayName) parts.push(input.topicDisplayName);
  return parts.join(" · ");
}

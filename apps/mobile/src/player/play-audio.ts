import type { FileDto, PlaylistItem } from "@app/shared-types";
import { getApiClient } from "../lib/api";
import { buildQueue } from "./logic";
import type { PlayerQueueItem } from "./types";

export type PlayAudioContext = {
  sessionId: string;
  sessionDisplayName: string;
  groupDisplayName: string;
  topicDisplayName?: string;
  /** Files in the current container (topic or session-level list). */
  containerFiles: FileDto[];
};

/**
 * Prefer session playlist URLs (correct order + fresh presigns), filtered to the
 * current container's ready audio. Fall back to per-file URL fetch.
 */
export async function resolveQueueForContainer(ctx: PlayAudioContext): Promise<PlayerQueueItem[]> {
  const ready = ctx.containerFiles
    .filter((file) => file.kind === "audio" && file.status === "ready")
    .slice()
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  if (ready.length === 0) return [];

  const idSet = new Set(ready.map((file) => file.id));
  let playlistItems: PlaylistItem[] = [];
  try {
    const playlist = await getApiClient().getPlaylist(ctx.sessionId);
    playlistItems = playlist.items.filter((item) => idSet.has(item.fileId));
  } catch {
    playlistItems = [];
  }

  if (playlistItems.length > 0) {
    // Keep container number order, use playlist URLs where present.
    const urlById = Object.fromEntries(playlistItems.map((item) => [item.fileId, item.url]));
    const topicById = Object.fromEntries(
      playlistItems
        .filter((item) => item.topicDisplayName)
        .map((item) => [item.fileId, item.topicDisplayName!]),
    );
    return buildQueue(
      ready,
      {
        sessionDisplayName: ctx.sessionDisplayName,
        groupDisplayName: ctx.groupDisplayName,
        topicDisplayName: ctx.topicDisplayName,
      },
      urlById,
    ).map((item) => ({
      ...item,
      topicDisplayName: item.topicDisplayName ?? topicById[item.fileId] ?? ctx.topicDisplayName,
    }));
  }

  const urlsByFileId: Record<string, string> = {};
  await Promise.all(
    ready.map(async (file) => {
      const { url } = await getApiClient().getFileUrl(file.id, false);
      urlsByFileId[file.id] = url;
    }),
  );
  return buildQueue(
    ready,
    {
      sessionDisplayName: ctx.sessionDisplayName,
      groupDisplayName: ctx.groupDisplayName,
      topicDisplayName: ctx.topicDisplayName,
    },
    urlsByFileId,
  );
}

export function indexOfFile(queue: PlayerQueueItem[], fileId: string): number {
  const index = queue.findIndex((item) => item.fileId === fileId);
  return index >= 0 ? index : 0;
}

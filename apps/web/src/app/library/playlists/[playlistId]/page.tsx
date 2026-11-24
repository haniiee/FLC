"use client";

import type { PlaylistTrack } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ItemActionsMenu } from "../../../../components/content/ItemActionsMenu";
import { Button } from "../../../../components/ui/Button";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Hero } from "../../../../components/ui/Hero";
import { Spinner } from "../../../../components/ui/Spinner";
import { getApiClient } from "../../../../lib/api";
import { copy } from "../../../../lib/copy";
import { apiErrorMessage } from "../../../../lib/format";
import {
  buildPlaylistQueue,
  formatPlaylistSummary,
  moveDown,
  moveUp,
  playlistQueryKey,
  playlistsQueryKey,
  playlistTrackSubtitle,
} from "../../../../lib/playlist-logic";
import { usePlayer } from "../../../../player/context";

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const player = usePlayer();

  const playlistQuery = useQuery({
    queryKey: playlistQueryKey(playlistId),
    queryFn: () => getApiClient().playlists.get(playlistId),
  });

  const playlist = playlistQuery.data;

  function patchCache(next: NonNullable<typeof playlist>) {
    queryClient.setQueryData(playlistQueryKey(playlistId), next);
  }

  async function refreshPlaylist() {
    await queryClient.invalidateQueries({ queryKey: playlistQueryKey(playlistId) });
    await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
  }

  async function playAll() {
    if (!playlist) return;
    const { items } = buildPlaylistQueue(playlist.items);
    if (items.length === 0) {
      toast.error(copy.library.nothingToPlay);
      return;
    }
    try {
      await player.playPersonalPlaylist(playlistId, 0);
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.player.playlistLoadFailed));
    }
  }

  async function playTrack(track: PlaylistTrack) {
    if (!track.available) return;
    const { startIndex, items } = buildPlaylistQueue(playlist?.items ?? [], track.fileId);
    if (items.length === 0) {
      toast.error(copy.library.nothingToPlay);
      return;
    }
    try {
      await player.playPersonalPlaylist(playlistId, startIndex);
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.player.playlistLoadFailed));
    }
  }

  async function saveReorder(nextFileIds: string[]) {
    try {
      const updated = await getApiClient().playlists.reorder(playlistId, { fileIds: nextFileIds });
      patchCache(updated);
      await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.library.reorderFailed));
      await refreshPlaylist();
    }
  }

  if (playlistQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!playlist) {
    return <EmptyState title={copy.library.playlistNotFound} />;
  }

  const fileIds = playlist.items.map((item) => item.fileId);

  return (
    <div className="space-y-4">
      <Hero>
        <Link href="/library" className="text-xs font-medium text-white/70 hover:text-white">
          ← {copy.library.playlists}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold" dir="auto">
              {playlist.displayName}
            </h1>
            <p className="mt-1 text-sm text-white/75">
              {formatPlaylistSummary(playlist.itemCount, playlist.totalDurationMs)}
            </p>
          </div>
          <ItemActionsMenu
            title={playlist.title}
            onRename={async (title) => {
              const updated = await getApiClient().playlists.rename(playlistId, { title });
              patchCache(updated);
              await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
            }}
            onDelete={async () => {
              await getApiClient().playlists.remove(playlistId);
              await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
              router.replace("/library");
            }}
          />
        </div>
        <Button type="button" className="mt-4 w-full" onClick={() => void playAll()}>
          {copy.library.playAll}
        </Button>
      </Hero>

      {playlist.items.length === 0 ? (
        <EmptyState title={copy.library.emptyPlaylists} />
      ) : (
        <ul className="space-y-2">
          {playlist.items.map((track, index) => {
            const unavailable = !track.available;
            return (
              <li
                key={track.fileId}
                className={`rounded-lg border border-border bg-surface p-3 ${unavailable ? "opacity-55" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-on-primary disabled:opacity-40"
                    disabled={unavailable}
                    onClick={() => void playTrack(track)}
                  >
                    ▶
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text" dir="auto">
                      {track.displayName}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted" dir="auto">
                      {playlistTrackSubtitle(track)}
                    </p>
                    {unavailable ? (
                      <span className="mt-2 inline-block rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                        {copy.library.unavailable}
                      </span>
                    ) : null}
                  </div>
                  <ItemActionsMenu
                    title={null}
                    extraActions={[
                      {
                        title: copy.library.moveUp,
                        onPress: () => {
                          const next = moveUp(fileIds, index).map((item) => item);
                          void saveReorder(next);
                        },
                      },
                      {
                        title: copy.library.moveDown,
                        onPress: () => {
                          const next = moveDown(fileIds, index);
                          void saveReorder(next);
                        },
                      },
                      {
                        title: copy.library.removeFromPlaylist,
                        destructive: true,
                        onPress: () => {
                          void (async () => {
                            try {
                              const updated = await getApiClient().playlists.removeItem(
                                playlistId,
                                track.fileId,
                              );
                              patchCache(updated);
                              await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
                            } catch (error) {
                              toast.error(apiErrorMessage(error));
                            }
                          })();
                        },
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

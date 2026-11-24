"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getApiClient } from "../../lib/api";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { playlistQueryKey, playlistsQueryKey } from "../../lib/playlist-logic";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";

function allFileIdsInPlaylist(
  detail: { items: { fileId: string }[] } | undefined,
  fileIds: string[],
): boolean {
  if (!detail || fileIds.length === 0) return false;
  const set = new Set(detail.items.map((item) => item.fileId));
  return fileIds.every((id) => set.has(id));
}

export function AddToPlaylistModal({
  open,
  onClose,
  fileIds,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  fileIds: string[];
  onAdded?: (name: string) => void;
}) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const listQuery = useQuery({
    queryKey: playlistsQueryKey,
    queryFn: () => getApiClient().playlists.list(),
    enabled: open,
  });

  const items = listQuery.data?.items ?? [];

  const detailQueries = useQueries({
    queries: items.map((playlist) => ({
      queryKey: playlistQueryKey(playlist.id),
      queryFn: () => getApiClient().playlists.get(playlist.id),
      enabled: open && fileIds.length > 0,
      staleTime: 30_000,
    })),
  });

  useEffect(() => {
    if (!open) {
      setBusyId(null);
      setCreating(false);
    }
  }, [open]);

  async function finishAdd(displayName: string) {
    toast.success(copy.library.addedTo(displayName));
    onAdded?.(displayName);
    await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
    window.setTimeout(() => onClose(), 350);
  }

  async function addToExisting(playlistId: string, displayName: string) {
    setBusyId(playlistId);
    try {
      await getApiClient().playlists.addItems(playlistId, { fileIds });
      await queryClient.invalidateQueries({ queryKey: playlistQueryKey(playlistId) });
      await finishAdd(displayName);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function createNew() {
    setCreating(true);
    try {
      const created = await getApiClient().playlists.create(
        fileIds.length > 0 ? { fileIds } : undefined,
      );
      await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
      await finishAdd(created.displayName);
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.library.createFailed));
    } finally {
      setCreating(false);
    }
  }

  const loading = listQuery.isLoading;

  return (
    <Modal open={open} onClose={onClose} title={copy.library.addToPlaylist} wide>
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {items.map((playlist, index) => {
              const detail = detailQueries[index]?.data;
              const checked = allFileIdsInPlaylist(detail, fileIds);
              const busy = busyId === playlist.id;
              return (
                <li key={playlist.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-between px-3 py-2.5 text-start"
                    disabled={busy || creating || checked}
                    onClick={() => void addToExisting(playlist.id, playlist.displayName)}
                  >
                    <span className="min-w-0 truncate font-medium text-text" dir="auto">
                      {playlist.displayName}
                    </span>
                    <span className="ms-2 shrink-0 text-sm text-text-muted">
                      {checked ? "✓" : busy ? <Spinner className="h-4 w-4" /> : null}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            className="w-full"
            disabled={creating || Boolean(busyId)}
            onClick={() => void createNew()}
          >
            {creating ? copy.common.loading : copy.library.newPlaylist}
          </Button>
        </div>
      )}
    </Modal>
  );
}

"use client";

import type { FileDto, GroupRole } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getApiClient } from "../../lib/api";
import {
  bookmarksForFileQueryKey,
  bookmarksQueryKey,
  fileLevelBookmark,
  isFileBookmarked,
} from "../../lib/bookmark-logic";
import { copy } from "../../lib/copy";
import { apiErrorMessage, formatBytes, formatDuration, kindLabel } from "../../lib/format";
import { usePlayer } from "../../player/context";
import { usePlayerStore } from "../../player/store";
import { AddToPlaylistModal } from "../playlists/AddToPlaylistModal";
import { ItemActionsMenu } from "../content/ItemActionsMenu";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

function KindIcon({ kind }: { kind: FileDto["kind"] }) {
  const map = {
    audio: "🎵",
    pdf: "📄",
    image: "🖼️",
    video: "🎬",
    text: "📝",
  } as const;
  return <span aria-hidden>{map[kind]}</span>;
}

export function canManageContent(role: GroupRole | undefined) {
  return role === "teacher" || role === "assistant";
}

function StatusBadge({
  status,
  canManage,
  onReprocess,
}: {
  status: FileDto["status"];
  canManage: boolean;
  onReprocess?: () => void;
}) {
  if (status === "ready") {
    return null;
  }
  if (status === "processing") {
    return (
      <span className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] bg-primary-soft text-secondary">
        {copy.content.processing}
      </span>
    );
  }
  if (status === "pending" && canManage) {
    return (
      <span className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] bg-primary-soft text-secondary">
        {copy.content.awaitingUpload}
      </span>
    );
  }
  if (status === "failed" && canManage) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded bg-danger/10 px-2 py-0.5 text-[11px] text-danger">
          {copy.content.errorLabel}
        </span>
        {onReprocess ? (
          <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={onReprocess}>
            {copy.content.reprocess}
          </Button>
        ) : null}
      </div>
    );
  }
  return null;
}

export function OptimisticFileRow({ title, progress }: { title: string; progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl" aria-hidden>
          🎵
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text">{title}</p>
          <p className="mt-1 text-xs text-text-muted">
            {kindLabel("audio")} · <bdi dir="ltr">{pct}%</bdi>
          </p>
          <span className="mt-2 inline-block rounded-md bg-primary-soft px-2 py-0.5 text-[11px] text-secondary">
            {copy.content.uploading}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FileRow({
  file,
  canManage,
  onChanged,
  sessionId,
  selectMode,
  selected,
  onToggleSelect,
}: {
  file: FileDto;
  canManage: boolean;
  onChanged: () => void;
  sessionId?: string;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const player = usePlayer();
  const queryClient = useQueryClient();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentFileId = usePlayerStore((s) => s.queue[s.currentIndex]?.fileId);
  const isCurrent = currentFileId === file.id;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const playable = file.status === "ready";

  const bookmarksQuery = useQuery({
    queryKey: bookmarksForFileQueryKey(file.id),
    queryFn: () => getApiClient().bookmarks.list({ fileId: file.id }),
    enabled: playable,
  });

  const fileBookmarked = isFileBookmarked(bookmarksQuery.data?.items ?? [], file.id);

  async function resolveUrl(download = false) {
    const result = await getApiClient().getFileUrl(file.id, download);
    return result.url;
  }

  async function onOpen() {
    try {
      if (!playable) {
        return;
      }
      if (file.kind === "audio") {
        if (!sessionId) {
          toast.error(copy.content.sessionIdMissing);
          return;
        }
        if (isCurrent) {
          player.toggle();
          return;
        }
        await player.playSession(sessionId, file.id);
        return;
      }
      if (file.kind === "image") {
        setImageUrl(await resolveUrl(false));
        return;
      }
      if (file.kind === "pdf") {
        window.open(await resolveUrl(false), "_blank", "noopener,noreferrer");
        return;
      }
      if (file.kind === "video") {
        setVideoUrl(await resolveUrl(false));
        return;
      }
      if (file.kind === "text") {
        setTextOpen(true);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.content.openFailed));
    }
  }

  async function onDownload() {
    try {
      window.open(await resolveUrl(true), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.content.downloadFailed));
    }
  }

  async function onReprocess() {
    setReprocessing(true);
    try {
      await getApiClient().reprocessFile(file.id);
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.content.reprocessFailed));
    } finally {
      setReprocessing(false);
    }
  }

  const sizePart = formatBytes(file.sizeBytes);
  const durationPart = formatDuration(file.durationMs);

  const actionExtras =
    playable && file.kind === "audio"
      ? [
          {
            title: copy.library.addToPlaylist,
            onPress: () => setPlaylistOpen(true),
          },
        ]
      : [];

  const bookmarkAction = playable
    ? {
        title: fileBookmarked ? copy.library.removeBookmark : copy.library.bookmark,
        onPress: () => {
          void (async () => {
            try {
              if (fileBookmarked) {
                const existing = fileLevelBookmark(bookmarksQuery.data?.items ?? [], file.id);
                if (existing) {
                  await getApiClient().bookmarks.remove(existing.id);
                  toast.success(copy.library.removeBookmark);
                }
              } else {
                await getApiClient().bookmarks.create({ fileId: file.id });
                toast.success(copy.library.bookmark);
              }
              await queryClient.invalidateQueries({ queryKey: bookmarksForFileQueryKey(file.id) });
              await queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
            } catch (error) {
              toast.error(apiErrorMessage(error));
            }
          })();
        },
      }
    : null;

  const showActionsMenu = canManage || playable;

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        {selectMode && playable && file.kind === "audio" ? (
          <button
            type="button"
            aria-pressed={selected}
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-background"
            onClick={onToggleSelect}
          >
            {selected ? "✓" : ""}
          </button>
        ) : null}
        {file.kind === "audio" && playable ? (
          <button
            type="button"
            aria-label={isCurrent && isPlaying ? copy.player.pause : copy.player.play}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-on-primary"
            onClick={() => void onOpen()}
          >
            {isCurrent && isPlaying ? "❚❚" : "▶"}
          </button>
        ) : (
          <button
            type="button"
            className="mt-0.5 text-xl disabled:opacity-40"
            disabled={!playable && file.kind === "audio"}
            onClick={() => void onOpen()}
          >
            <KindIcon kind={file.kind} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full text-start font-medium text-text disabled:opacity-60"
            disabled={!playable && file.kind === "audio"}
            onClick={() => void onOpen()}
          >
            <span dir="auto">{file.displayName}</span>
          </button>
          <p className="mt-1 text-xs text-text-muted">
            {kindLabel(file.kind)}
            {sizePart ? (
              <>
                {" · "}
                <bdi dir="ltr">{sizePart}</bdi>
              </>
            ) : null}
            {durationPart ? (
              <>
                {" · "}
                <bdi dir="ltr">{durationPart}</bdi>
              </>
            ) : null}
          </p>
          <StatusBadge
            status={file.status}
            canManage={canManage}
            onReprocess={
              file.status === "failed" && canManage && !reprocessing
                ? () => void onReprocess()
                : undefined
            }
          />
        </div>
        <div className="flex items-center gap-1">
          {playable ? (
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => void onDownload()}
            >
              {copy.content.download}
            </Button>
          ) : null}
          {showActionsMenu ? (
            <ItemActionsMenu
              title={file.title}
              extraActions={[...actionExtras, ...(bookmarkAction ? [bookmarkAction] : [])]}
              onRename={
                canManage
                  ? async (title) => {
                      await getApiClient().updateFile(file.id, { title });
                      onChanged();
                    }
                  : undefined
              }
              onDelete={
                canManage
                  ? async () => {
                      await getApiClient().deleteFile(file.id);
                      onChanged();
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      </div>

      <AddToPlaylistModal
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        fileIds={[file.id]}
      />

      <Sheet
        open={Boolean(imageUrl)}
        onClose={() => setImageUrl(null)}
        title={file.displayName ?? undefined}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={file.displayName ?? ""}
            className="max-h-[70vh] w-full object-contain"
          />
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(videoUrl)}
        onClose={() => setVideoUrl(null)}
        title={file.displayName ?? undefined}
      >
        {videoUrl ? <video className="w-full rounded-md" controls src={videoUrl} /> : null}
      </Sheet>

      <Sheet
        open={textOpen}
        onClose={() => setTextOpen(false)}
        title={file.displayName ?? undefined}
      >
        <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm text-text">
          {file.textContent ?? copy.content.textUnavailable}
        </pre>
      </Sheet>
    </div>
  );
}

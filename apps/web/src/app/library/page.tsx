"use client";

import type { Bookmark, FileKind } from "@app/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "../../components/content/ItemActionsMenu";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Hero } from "../../components/ui/Hero";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { getApiClient } from "../../lib/api";
import {
  bookmarksQueryKey,
  filterBookmarksByKind,
  formatBookmarkAt,
  type BookmarkKindFilter,
} from "../../lib/bookmark-logic";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import {
  formatPlaylistSummary,
  playlistTrackSubtitle,
  playlistsQueryKey,
} from "../../lib/playlist-logic";
import { usePlayer } from "../../player/context";
import type { PlayerQueueItem } from "../../player/types";

type LibraryTab = "playlists" | "bookmarks";

const KIND_FILTERS: { id: BookmarkKindFilter; label: string }[] = [
  { id: "all", label: copy.library.all },
  { id: "audio", label: copy.library.audio },
  { id: "pdf", label: copy.library.pdf },
  { id: "image", label: copy.library.image },
  { id: "video", label: copy.library.video },
  { id: "text", label: copy.library.text },
];

function KindIcon({ kind }: { kind: FileKind }) {
  const map = {
    audio: "🎵",
    pdf: "📄",
    image: "🖼️",
    video: "🎬",
    text: "📝",
  } as const;
  return <span aria-hidden>{map[kind]}</span>;
}

function bookmarkSubtitle(bookmark: Bookmark): string {
  return playlistTrackSubtitle({
    groupDisplayName: bookmark.file.groupDisplayName,
    sessionDisplayName: bookmark.file.sessionDisplayName,
    topicDisplayName: bookmark.file.topicDisplayName,
  });
}

function queueItemFromBookmark(bookmark: Bookmark): PlayerQueueItem | null {
  if (!bookmark.url) return null;
  const item: PlayerQueueItem = {
    fileId: bookmark.fileId,
    displayName: bookmark.file.displayName,
    durationMs: bookmark.file.durationMs,
    url: bookmark.url,
    sessionDisplayName: bookmark.file.sessionDisplayName,
    groupDisplayName: bookmark.file.groupDisplayName,
  };
  if (bookmark.file.topicDisplayName) {
    item.topicDisplayName = bookmark.file.topicDisplayName;
  }
  return item;
}

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const player = usePlayer();

  const tabParam = searchParams.get("tab");
  const tab: LibraryTab = tabParam === "bookmarks" ? "bookmarks" : "playlists";

  const setTab = useCallback(
    (next: LibraryTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "bookmarks") {
        params.set("tab", "bookmarks");
      } else {
        params.delete("tab");
      }
      const qs = params.toString();
      router.replace(qs ? `/library?${qs}` : "/library");
    },
    [router, searchParams],
  );

  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [kindFilter, setKindFilter] = useState<BookmarkKindFilter>("all");
  const [editBookmark, setEditBookmark] = useState<Bookmark | null>(null);
  const [editNote, setEditNote] = useState("");

  const playlistsQuery = useQuery({
    queryKey: playlistsQueryKey,
    queryFn: () => getApiClient().playlists.list(),
    enabled: tab === "playlists",
  });

  const bookmarksQuery = useQuery({
    queryKey: bookmarksQueryKey,
    queryFn: () => getApiClient().bookmarks.list(),
    enabled: tab === "bookmarks",
  });

  const createPlaylist = useMutation({
    mutationFn: async () => {
      const title = newPlaylistTitle.trim();
      return getApiClient().playlists.create(title.length > 0 ? { title } : undefined);
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
      toast.success(copy.library.addedTo(created.displayName));
      setNewPlaylistOpen(false);
      setNewPlaylistTitle("");
      router.push(`/library/playlists/${created.id}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, copy.library.createFailed)),
  });

  const updateBookmark = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string | null }) => {
      return getApiClient().bookmarks.update(id, { note });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
      toast.success(copy.library.save);
      setEditBookmark(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const removeBookmark = useMutation({
    mutationFn: (id: string) => getApiClient().bookmarks.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
      toast.success(copy.content.deleted);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const filteredBookmarks = useMemo(() => {
    const items = bookmarksQuery.data?.items ?? [];
    return filterBookmarksByKind(items, kindFilter);
  }, [bookmarksQuery.data?.items, kindFilter]);

  async function playPlaylist(id: string) {
    try {
      await player.playPersonalPlaylist(id, 0);
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.player.playlistLoadFailed));
    }
  }

  async function openBookmark(bookmark: Bookmark) {
    if (!bookmark.available) return;
    try {
      if (bookmark.kind === "audio") {
        const item = queueItemFromBookmark(bookmark);
        if (!item) {
          toast.error(copy.library.voiceUnavailable);
          return;
        }
        const startMs = bookmark.positionMs ?? 0;
        await player.playQueue([item], 0, startMs);
        return;
      }
      if (bookmark.url) {
        if (bookmark.kind === "text") {
          window.open(bookmark.url, "_blank", "noopener,noreferrer");
        } else {
          window.open(bookmark.url, "_blank", "noopener,noreferrer");
        }
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, copy.content.openFailed));
    }
  }

  const loading =
    (tab === "playlists" && playlistsQuery.isLoading) ||
    (tab === "bookmarks" && bookmarksQuery.isLoading);

  const loadError =
    (tab === "playlists" && playlistsQuery.isError) ||
    (tab === "bookmarks" && bookmarksQuery.isError);

  return (
    <div className="space-y-4">
      <Hero>
        <h1 className="text-2xl font-extrabold">{copy.library.title}</h1>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant={tab === "playlists" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setTab("playlists")}
          >
            {copy.library.playlists}
          </Button>
          <Button
            type="button"
            variant={tab === "bookmarks" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setTab("bookmarks")}
          >
            {copy.library.bookmarks}
          </Button>
        </div>
      </Hero>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : loadError ? (
        <EmptyState
          title={copy.library.loadFailed}
          action={
            <Button
              type="button"
              onClick={() => {
                if (tab === "playlists") void playlistsQuery.refetch();
                else void bookmarksQuery.refetch();
              }}
            >
              {copy.library.retry}
            </Button>
          }
        />
      ) : tab === "playlists" ? (
        <>
          <Button type="button" className="w-full" onClick={() => setNewPlaylistOpen(true)}>
            {copy.library.newPlaylist}
          </Button>
          {(playlistsQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title={copy.library.emptyPlaylists}
              description={copy.library.emptyPlaylistsSubtitle}
            />
          ) : (
            <ul className="space-y-2">
              {playlistsQuery.data?.items.map((playlist) => (
                <li key={playlist.id}>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
                    <Link href={`/library/playlists/${playlist.id}`} className="min-w-0 flex-1">
                      <p className="font-medium text-text" dir="auto">
                        {playlist.displayName}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {formatPlaylistSummary(playlist.itemCount, playlist.totalDurationMs)}
                      </p>
                    </Link>
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 px-3"
                      onClick={() => void playPlaylist(playlist.id)}
                    >
                      {copy.content.play}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  kindFilter === filter.id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-muted text-text-muted"
                }`}
                onClick={() => setKindFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {(bookmarksQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title={copy.library.emptyBookmarks}
              description={copy.library.emptyBookmarksSubtitle}
            />
          ) : filteredBookmarks.length === 0 ? (
            <EmptyState title={copy.library.nothingInFilter} />
          ) : (
            <ul className="space-y-2">
              {filteredBookmarks.map((bookmark) => {
                const unavailable = !bookmark.available;
                return (
                  <li
                    key={bookmark.id}
                    className={`rounded-lg border border-border bg-surface p-3 ${unavailable ? "opacity-55" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className="mt-0.5 text-xl disabled:cursor-default"
                        disabled={unavailable}
                        onClick={() => void openBookmark(bookmark)}
                      >
                        <KindIcon kind={bookmark.kind} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="block w-full text-start font-medium text-text disabled:cursor-default"
                          disabled={unavailable}
                          onClick={() => void openBookmark(bookmark)}
                        >
                          <span dir="auto">{bookmark.file.displayName}</span>
                        </button>
                        <p className="mt-0.5 text-xs text-text-muted" dir="auto">
                          {bookmarkSubtitle(bookmark)}
                        </p>
                        {bookmark.kind === "audio" && bookmark.positionMs != null ? (
                          <p className="mt-0.5 text-xs text-text-muted">
                            {formatBookmarkAt(bookmark.positionMs)}
                          </p>
                        ) : null}
                        {bookmark.note ? (
                          <p className="mt-1 text-sm text-text" dir="auto">
                            {bookmark.note}
                          </p>
                        ) : null}
                        {unavailable ? (
                          <span className="mt-2 inline-block rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                            {copy.library.unavailable}
                          </span>
                        ) : null}
                      </div>
                      <ItemActionsMenu
                        extraActions={[
                          {
                            title: copy.library.editNote,
                            onPress: () => {
                              setEditBookmark(bookmark);
                              setEditNote(bookmark.note ?? "");
                            },
                          },
                          {
                            title: copy.content.delete,
                            destructive: true,
                            onPress: () => {
                              void removeBookmark.mutateAsync(bookmark.id);
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
        </>
      )}

      <Modal
        open={newPlaylistOpen}
        onClose={() => {
          setNewPlaylistOpen(false);
          setNewPlaylistTitle("");
        }}
        title={copy.library.newPlaylist}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createPlaylist.mutate();
          }}
        >
          <Input
            label={copy.library.playlistName}
            placeholder={copy.library.playlistNameHint}
            value={newPlaylistTitle}
            onChange={(event) => setNewPlaylistTitle(event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={createPlaylist.isPending}>
            {copy.library.create}
          </Button>
        </form>
      </Modal>

      <Modal
        open={editBookmark != null}
        onClose={() => setEditBookmark(null)}
        title={copy.library.editNote}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editBookmark) return;
            const note = editNote.trim();
            updateBookmark.mutate({
              id: editBookmark.id,
              note: note.length > 0 ? note : null,
            });
          }}
        >
          <Input
            label={copy.library.note}
            placeholder={copy.library.notePlaceholder}
            value={editNote}
            onChange={(event) => setEditNote(event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={updateBookmark.isPending}>
            {copy.library.save}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddToPlaylistModal } from "../components/playlists/AddToPlaylistModal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { getApiClient } from "../lib/api";
import { bookmarksQueryKey, formatBookmarkClock } from "../lib/bookmark-logic";
import { copy } from "../lib/copy";
import { apiErrorMessage } from "../lib/format";
import { usePlayer } from "./context";
import { formatClock } from "./format-time";
import { selectCurrentItem, usePlayerStore } from "./store";
import { PLAYBACK_RATES } from "./types";

function RepeatButton({ mode, onClick }: { mode: "off" | "all" | "one"; onClick: () => void }) {
  const label =
    mode === "off"
      ? copy.player.repeatOff
      : mode === "all"
        ? copy.player.repeatAll
        : copy.player.repeatOne;
  return (
    <button
      type="button"
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
      onClick={onClick}
    >
      <span className={`text-xl ${mode === "off" ? "text-white/35" : "text-primary"}`} aria-hidden>
        🔁
      </span>
      {mode === "one" ? (
        <span
          className="absolute bottom-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-on-primary"
          aria-hidden
        >
          1
        </span>
      ) : null}
    </button>
  );
}

export function FullPlayer() {
  const player = usePlayer();
  const queryClient = useQueryClient();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const open = usePlayerStore((s) => s.fullPlayerOpen);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const rate = usePlayerStore((s) => s.rate);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const current = usePlayerStore(selectCurrentItem);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        player.closeFullPlayer();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, player]);

  if (!open || !current) {
    return null;
  }

  const progressMax = duration > 0 ? duration : 1;

  return (
    <div className="fixed inset-0 z-50 bg-hero-navy text-white">
      <div className="mx-auto flex h-full max-w-[720px] flex-col px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between py-3">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-white/80 hover:bg-white/10"
            onClick={() => player.closeFullPlayer()}
          >
            {copy.common.close}
          </button>
          <p className="text-xs text-white/70" dir="auto">
            {current.groupDisplayName}
          </p>
          <span className="w-12" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <img
            src="/icons/icon-512.png"
            alt=""
            width={160}
            height={160}
            className="h-40 w-40 rounded-xl border border-white/10 bg-white/10 object-contain p-4 shadow-card"
          />
          <div className="w-full text-center">
            <h2 className="text-xl font-bold text-white" dir="auto">
              {current.displayName}
            </h2>
            <p className="mt-1 text-sm text-white/70" dir="auto">
              {current.topicDisplayName || current.sessionDisplayName}
            </p>
          </div>

          <div className="w-full space-y-4">
            <div className="w-full space-y-2">
              <input
                type="range"
                min={0}
                max={progressMax}
                step={0.1}
                value={Math.min(position, progressMax)}
                onChange={(event) => player.seek(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer accent-primary"
                aria-label={copy.player.seek}
              />
              <div className="flex justify-between text-xs text-white/70">
                <span>{formatClock(position)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label={copy.player.previous}
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white hover:bg-white/10"
                onClick={() => player.prev()}
              >
                ⏮
              </button>
              <button
                type="button"
                aria-label={copy.player.skipBack10}
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => player.skip(-10)}
              >
                −10
              </button>
              <button
                type="button"
                aria-label={isPlaying ? copy.player.pause : copy.player.play}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl text-on-primary shadow-card"
                onClick={() => player.toggle()}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>
              <button
                type="button"
                aria-label={copy.player.skipForward10}
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => player.skip(10)}
              >
                +10
              </button>
              <button
                type="button"
                aria-label={copy.player.next}
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white hover:bg-white/10"
                onClick={() => player.next()}
              >
                ⏭
              </button>
            </div>

            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-white/85 hover:bg-white/10"
                onClick={() => setPlaylistOpen(true)}
              >
                {copy.player.addToPlaylist}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-white/85 hover:bg-white/10"
                onClick={() => {
                  setBookmarkNote("");
                  setBookmarkOpen(true);
                }}
              >
                {copy.player.bookmarkMoment}
              </Button>
            </div>

            <div className="flex w-full items-center justify-between gap-3">
              <RepeatButton mode={repeatMode} onClick={() => player.cycleRepeat()} />
              <div className="flex flex-wrap justify-center gap-1">
                {PLAYBACK_RATES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      rate === value ? "bg-primary text-on-primary" : "bg-white/10 text-white/80"
                    }`}
                    onClick={() => player.setRate(value)}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[28vh] overflow-y-auto rounded-t-xl border-t border-white/10 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">
            {copy.player.queue}
          </p>
          <ul className="space-y-1">
            {queue.map((item, index) => {
              const active = index === currentIndex;
              return (
                <li key={item.fileId}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={`w-full justify-start px-3 py-2 text-start text-sm ${
                      active ? "bg-primary/20 text-primary" : "text-white/85 hover:bg-white/10"
                    }`}
                    onClick={() => player.jumpTo(index)}
                  >
                    <span className="truncate" dir="auto">
                      {item.displayName}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <AddToPlaylistModal
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        fileIds={current.fileId ? [current.fileId] : []}
      />

      <Modal
        open={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        title={copy.player.bookmarkMoment}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setBookmarkBusy(true);
              try {
                const note = bookmarkNote.trim();
                await getApiClient().bookmarks.create({
                  fileId: current.fileId,
                  positionMs: Math.round(position * 1000),
                  note: note.length > 0 ? note : null,
                });
                await queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
                toast.success(
                  copy.library.bookmarkedAt(formatBookmarkClock(Math.round(position * 1000))),
                );
                setBookmarkOpen(false);
              } catch (error) {
                toast.error(apiErrorMessage(error));
              } finally {
                setBookmarkBusy(false);
              }
            })();
          }}
        >
          <Input
            label={copy.library.note}
            placeholder={copy.library.notePlaceholder}
            value={bookmarkNote}
            onChange={(event) => setBookmarkNote(event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={bookmarkBusy}>
            {copy.library.save}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

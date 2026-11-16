"use client";

import { usePlayer } from "./context";
import { selectCurrentItem, usePlayerStore } from "./store";

export function MiniPlayer() {
  const player = usePlayer();
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const current = usePlayerStore(selectCurrentItem);

  if (!queue.length || !current) {
    return null;
  }

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[720px]">
        <div className="h-1 w-full bg-border">
          <div
            className="h-full bg-primary transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-right"
            onClick={() => player.openFullPlayer()}
          >
            <p className="truncate text-sm font-semibold text-secondary">{current.displayName}</p>
            <p className="truncate text-[11px] text-text-muted">
              {current.topicDisplayName || current.sessionDisplayName}
            </p>
          </button>
          <div className="flex items-center gap-1" dir="ltr">
            <button
              type="button"
              aria-label={isPlaying ? "توقف" : "پخش"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg text-on-primary"
              onClick={() => player.toggle()}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              aria-label="بعدی"
              className="flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-border/60"
              onClick={() => player.next()}
            >
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

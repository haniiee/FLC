"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { copy } from "../lib/copy";
import { useAuth } from "../providers/auth-provider";
import { usePlayer } from "./context";
import { selectCurrentItem, usePlayerStore } from "./store";

const AUTH_PREFIXES = ["/login", "/register", "/change-password", "/join"];

export function MiniPlayer() {
  const player = usePlayer();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const current = usePlayerStore(selectCurrentItem);

  if (!queue.length || !current) {
    return null;
  }

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const showBottomNav =
    isAuthenticated &&
    !AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return (
    <div
      className={clsx(
        "fixed inset-x-0 z-40 border-t border-border bg-surface/95 shadow-card backdrop-blur",
        showBottomNav
          ? "bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[env(safe-area-inset-bottom)]"
          : "bottom-0 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="mx-auto max-w-[720px]">
        <div className="h-1 w-full bg-border">
          <div
            className="h-full bg-secondary transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-start"
            onClick={() => player.openFullPlayer()}
          >
            <p className="truncate text-sm font-semibold text-secondary" dir="auto">
              {current.displayName}
            </p>
            <p className="truncate text-[11px] text-text-muted" dir="auto">
              {current.topicDisplayName || current.sessionDisplayName}
            </p>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={isPlaying ? copy.player.pause : copy.player.play}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg text-on-primary shadow-card"
              onClick={() => player.toggle()}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              aria-label={copy.player.next}
              className="flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-border/60"
              onClick={() => player.next()}
            >
              ⏭
            </button>
            <button
              type="button"
              aria-label={copy.player.close}
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-border/60 hover:text-text"
              onClick={() => player.dismiss()}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

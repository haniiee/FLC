"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/Button";
import { usePlayer } from "./context";
import { formatClock } from "./format-time";
import { selectCurrentItem, usePlayerStore } from "./store";
import { PLAYBACK_RATES } from "./types";

function RepeatButton({ mode, onClick }: { mode: "off" | "all" | "one"; onClick: () => void }) {
  const label = mode === "off" ? "تکرار خاموش" : mode === "all" ? "تکرار همه" : "تکرار یکی";
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
    <div className="fixed inset-0 z-50 bg-secondary text-on-primary">
      <div className="mx-auto flex h-full max-w-[720px] flex-col px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between py-3">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-white/80 hover:bg-white/10"
            onClick={() => player.closeFullPlayer()}
          >
            بستن
          </button>
          <p className="text-xs text-white/70">{current.groupDisplayName}</p>
          <span className="w-12" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <img
            src="/icons/icon-512.png"
            alt=""
            width={160}
            height={160}
            className="h-40 w-40 rounded-2xl bg-white/10 object-contain p-4"
          />
          <div className="w-full text-center">
            <h2 className="text-xl font-bold text-white">{current.displayName}</h2>
            <p className="mt-1 text-sm text-white/70">
              {current.topicDisplayName || current.sessionDisplayName}
            </p>
          </div>

          <div className="w-full space-y-4" dir="ltr">
            <div className="w-full space-y-2">
              <input
                type="range"
                min={0}
                max={progressMax}
                step={0.1}
                value={Math.min(position, progressMax)}
                onChange={(event) => player.seek(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer accent-primary"
                aria-label="جابجایی در ویس"
              />
              <div className="flex justify-between text-xs text-white/70">
                <span>{formatClock(position)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="قبلی"
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white hover:bg-white/10"
                onClick={() => player.prev()}
              >
                ⏮
              </button>
              <button
                type="button"
                aria-label="۱۵ ثانیه عقب"
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => player.skip(-15)}
              >
                −15
              </button>
              <button
                type="button"
                aria-label={isPlaying ? "توقف" : "پخش"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl text-on-primary shadow-lg"
                onClick={() => player.toggle()}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>
              <button
                type="button"
                aria-label="۱۵ ثانیه جلو"
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => player.skip(15)}
              >
                +15
              </button>
              <button
                type="button"
                aria-label="بعدی"
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white hover:bg-white/10"
                onClick={() => player.next()}
              >
                ⏭
              </button>
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

        <div className="max-h-[28vh] overflow-y-auto border-t border-white/10 py-3">
          <p className="mb-2 text-xs text-white/60">صف پخش</p>
          <ul className="space-y-1">
            {queue.map((item, index) => {
              const active = index === currentIndex;
              return (
                <li key={item.fileId}>
                  <Button
                    type="button"
                    variant="ghost"
                    className={`w-full justify-start px-3 py-2 text-right text-sm ${
                      active ? "bg-primary/20 text-primary" : "text-white/85 hover:bg-white/10"
                    }`}
                    onClick={() => player.jumpTo(index)}
                  >
                    <span className="truncate">{item.displayName}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

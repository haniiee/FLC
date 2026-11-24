"use client";

import { copy } from "../lib/copy";
import { Button } from "../components/ui/Button";
import { usePlayer } from "./context";
import { usePlayerStore } from "./store";

export function ResumeBanner() {
  const player = usePlayer();
  const prompt = usePlayerStore((s) => s.resumePrompt);
  const hasActiveQueue = usePlayerStore((s) => s.hasActiveQueue);

  if (!prompt || hasActiveQueue) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-secondary/30 bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-card">
      <div className="mx-auto flex max-w-[720px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-secondary">{copy.player.resumePlayback}</p>
          <p className="truncate text-xs text-text-muted" dir="auto">
            {prompt.sessionDisplayName} · {prompt.groupDisplayName}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={() => player.dismissResume()}
        >
          {copy.common.close}
        </Button>
        <Button
          type="button"
          className="px-3 py-2 text-sm"
          onClick={() => void player.resumeSaved()}
        >
          {copy.player.resume}
        </Button>
      </div>
    </div>
  );
}

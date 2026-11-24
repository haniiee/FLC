"use client";

import { copy } from "../../lib/copy";

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="border-b border-border bg-surface-muted/80 px-3 py-1.5 text-center text-xs font-medium text-text-muted">
      {copy.chat.reconnecting}
    </div>
  );
}

"use client";

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="border-b border-border bg-surface px-3 py-1.5 text-center text-xs text-text-muted">
      در حال اتصال…
    </div>
  );
}

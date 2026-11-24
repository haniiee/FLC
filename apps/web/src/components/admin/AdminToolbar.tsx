import type { ReactNode } from "react";

export function AdminToolbar({ search, actions }: { search: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/8 bg-white/80 p-3 shadow-[0_10px_40px_-28px_rgba(15,30,74,0.45)] backdrop-blur sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">{search}</div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted/60 px-4 py-10 text-center">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      {description ? <p className="mt-2 text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

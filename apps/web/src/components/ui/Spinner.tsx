import clsx from "clsx";
import { copy } from "../../lib/copy";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-border border-t-secondary",
        className,
      )}
      role="status"
      aria-label={copy.common.loading}
    />
  );
}

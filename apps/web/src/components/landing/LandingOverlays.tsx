"use client";

import clsx from "clsx";
import { landingCopy } from "../../lib/landing-copy";

export function ScrollHint({ hidden }: { hidden: boolean }) {
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-2 transition-opacity duration-500",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
        hidden ? "opacity-0" : "opacity-100",
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
        {landingCopy.scrollHint}
      </span>
      <span className="h-8 w-px animate-pulse bg-gradient-to-b from-white/70 to-transparent" />
    </div>
  );
}

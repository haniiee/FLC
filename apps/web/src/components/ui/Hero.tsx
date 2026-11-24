import type { ReactNode } from "react";
import clsx from "clsx";

export function Hero({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl bg-hero-navy p-5 text-white shadow-soft", className)}>
      {children}
    </div>
  );
}

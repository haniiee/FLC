"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import clsx from "clsx";

const TABS = [
  { href: "/admin/groups", label: "Classes" },
  { href: "/admin/users", label: "Users" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5" dir="ltr">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary/70">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold text-secondary">Platform console</h1>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-secondary underline-offset-2 hover:underline"
        >
          Back to app
        </Link>
      </div>

      <nav className="flex gap-2 border-b border-border pb-px">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-secondary text-secondary"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

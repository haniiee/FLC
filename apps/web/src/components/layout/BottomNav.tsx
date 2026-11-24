"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { copy } from "../../lib/copy";
import { useAuth } from "../../providers/auth-provider";

const HIDDEN_PREFIXES = ["/login", "/register", "/change-password", "/join"];

export function BottomNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const hidden =
    !isAuthenticated ||
    HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (hidden) {
    return null;
  }

  const tabs = [
    {
      href: "/home",
      label: copy.nav.classes,
      match: (p: string) =>
        p === "/home" ||
        p.startsWith("/groups") ||
        p.startsWith("/sessions") ||
        p.startsWith("/topics"),
    },
    {
      href: "/library",
      label: copy.nav.library,
      match: (p: string) => p.startsWith("/library"),
    },
    {
      href: "/profile",
      label: copy.nav.profile,
      match: (p: string) => p.startsWith("/profile"),
    },
    ...(user?.platformRole === "admin"
      ? [
          {
            href: "/admin/groups",
            label: copy.nav.admin,
            match: (p: string) => p.startsWith("/admin"),
          },
        ]
      : []),
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[720px] items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex min-w-[72px] flex-col items-center rounded-full px-4 py-2 text-xs font-semibold transition",
                active ? "bg-primary-soft text-primary" : "text-text-muted",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

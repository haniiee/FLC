"use client";

import flcLogo from "@app/brand/assets/flc-logo.svg";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { copy } from "../../lib/copy";
import { useAuth } from "../../providers/auth-provider";

const NAV = [
  {
    href: "/admin/groups",
    label: "Classes",
    hint: "Manage cohorts",
    match: (p: string) => p === "/admin/groups" || p.startsWith("/admin/groups/"),
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 19.5V6.2c0-.7.4-1.3 1-1.6l6.2-3.1c.5-.3 1.1-.3 1.6 0L19 4.6c.6.3 1 .9 1 1.6V19.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M12 22V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M4 12h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    hint: "Accounts & access",
    match: (p: string) => p.startsWith("/admin/users"),
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3.5 18.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M16.2 14.2c2 .3 3.6 1.4 4.3 3.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1.5 px-3">
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={clsx(
              "group relative flex items-start gap-3 rounded-xl px-3 py-3 transition",
              active
                ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "text-white/65 hover:bg-white/6 hover:text-white",
            )}
          >
            <span
              className={clsx(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                active ? "bg-secondary-light/30 text-white" : "bg-white/6 text-white/70",
              )}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-wide">{item.label}</span>
              <span className="mt-0.5 block text-xs text-white/45 group-hover:text-white/55">
                {item.hint}
              </span>
            </span>
            {active ? (
              <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-secondary-light" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  const logoSrc = typeof flcLogo === "string" ? flcLogo : flcLogo.src;
  return (
    <div className="px-5 pb-6 pt-7">
      <Link href="/admin/groups" onClick={onNavigate} className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <img src={logoSrc} alt="" width={28} height={28} className="opacity-95" />
        </span>
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {copy.brand.short}
          </span>
          <span className="mt-0.5 block text-lg font-extrabold tracking-tight text-white">
            Admin
          </span>
        </span>
      </Link>
    </div>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();
  return (
    <div className="mt-auto border-t border-white/10 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white" dir="auto">
            {user?.displayName ?? "Admin"}
          </p>
          <p className="truncate text-xs text-white/40" dir="ltr">
            {user?.phone}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-white/45 transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path
              d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path d="M13 12H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path
              d="M6.5 9.2 3.7 12l2.8 2.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {copy.auth.signOut}
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const activeLabel = NAV.find((item) => item.match(pathname))?.label ?? "Admin";

  return (
    <div className="relative min-h-dvh">
      {/* Desktop sidebar — fixed full viewport height */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-[272px] flex-col bg-primary text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex h-full min-h-0 flex-col overflow-y-auto">
          <SidebarBrand />
          <SidebarNav pathname={pathname} />
          <SidebarFooter />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-primary/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-dvh w-[min(288px,86vw)] flex-col bg-primary text-white shadow-2xl">
            <div className="relative flex h-full min-h-0 flex-col overflow-y-auto">
              <div className="flex items-start justify-between gap-2 pr-3">
                <div className="min-w-0 flex-1">
                  <SidebarBrand onNavigate={() => setMobileOpen(false)} />
                </div>
                <button
                  type="button"
                  className="mt-6 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                  onClick={() => setMobileOpen(false)}
                >
                  ✕
                </button>
              </div>
              <SidebarNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              <SidebarFooter />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="relative flex min-h-dvh min-w-0 flex-col lg:pl-[272px]">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 70% 45% at 100% 0%, rgba(61,107,255,0.08), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(15,30,74,0.05), transparent 45%), #F6F7FB",
          }}
        />

        <header className="sticky top-0 z-30 border-b border-primary/8 bg-[#F6F7FB]/85 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/10 bg-white text-primary shadow-sm lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary/55">
                Platform console
              </p>
              <h1 className="truncate text-lg font-bold tracking-tight text-primary sm:text-xl">
                {activeLabel}
              </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="admin-page-enter mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

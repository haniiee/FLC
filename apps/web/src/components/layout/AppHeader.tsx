"use client";

import flcLogo from "@app/brand/assets/flc-logo.svg";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "../../lib/copy";
import { useAuth } from "../../providers/auth-provider";
import { Button } from "../ui/Button";

const HIDDEN_PREFIXES = ["/login", "/register", "/change-password"];

export function AppHeader() {
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const logoSrc = typeof flcLogo === "string" ? flcLogo : flcLogo.src;
  const hidden = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (hidden) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-hero-from text-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoSrc} alt={`${copy.brand.short} logo`} width={36} height={36} />
          <span className="text-lg font-extrabold tracking-wide">{copy.brand.short}</span>
        </Link>
        {isAuthenticated ? (
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {copy.nav.classes}
            </Link>
            <Link
              href="/library"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {copy.nav.library}
            </Link>
            <Link
              href="/profile"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {copy.nav.profile}
            </Link>
            {user?.platformRole === "admin" ? (
              <Link
                href="/admin/groups"
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10"
              >
                {copy.nav.admin}
              </Link>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs text-white hover:bg-white/10"
              onClick={() => void logout()}
            >
              {copy.auth.signOut}
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

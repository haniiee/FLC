"use client";

import flcLogo from "@app/brand/assets/flc-logo.svg";
import Link from "next/link";
import { useAuth } from "../../providers/auth-provider";
import { Button } from "../ui/Button";

export function AppHeader() {
  const { user, logout, isAuthenticated } = useAuth();
  const logoSrc = typeof flcLogo === "string" ? flcLogo : flcLogo.src;

  return (
    <header className="sticky top-0 z-40 border-b border-secondary/20 bg-secondary text-on-primary pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoSrc} alt="لوگوی FLC" width={36} height={36} />
          <span className="text-lg font-bold tracking-wide text-white">FLC</span>
        </Link>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            {user?.platformRole === "admin" ? (
              <Link
                href="/admin"
                className="rounded-md px-2 py-1 text-xs font-medium text-white/95 hover:bg-white/10"
              >
                Admin
              </Link>
            ) : null}
            <span className="max-w-[140px] truncate text-xs text-white/90">
              {user?.displayName}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs text-white hover:bg-white/10"
              onClick={() => void logout()}
            >
              خروج
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

"use client";

import flcLogo from "@app/brand/assets/flc-logo.svg";
import Link from "next/link";
import { landingCopy } from "../../lib/landing-copy";

export function LandingHeader({ overlay = true }: { overlay?: boolean }) {
  const logoSrc = typeof flcLogo === "string" ? flcLogo : flcLogo.src;

  return (
    <header
      className={
        overlay
          ? "pointer-events-none absolute inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)]"
          : "relative z-30 bg-[#070D1F] pt-[env(safe-area-inset-top)]"
      }
    >
      <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-5 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img
            src={logoSrc}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 drop-shadow-md"
          />
          <span className="min-w-0">
            <span className="block truncate text-base font-extrabold tracking-wide text-white">
              {landingCopy.brand.short}
            </span>
            <span className="block truncate text-[10px] font-medium tracking-[0.04em] text-white/55 sm:text-[11px]">
              {landingCopy.brand.academy}
            </span>
          </span>
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/18 sm:px-4"
        >
          {landingCopy.header.signIn}
        </Link>
      </div>
    </header>
  );
}

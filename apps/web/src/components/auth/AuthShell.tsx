"use client";

import flcLogo from "@app/brand/assets/flc-logo.svg";
import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "../../lib/copy";

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const logoSrc = typeof flcLogo === "string" ? flcLogo : flcLogo.src;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070D1F] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 15% -10%, rgba(61,107,255,0.28), transparent 55%), radial-gradient(ellipse 55% 45% at 95% 20%, rgba(253,173,62,0.14), transparent 50%), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(15,30,74,0.95), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="auth-enter flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <img src={logoSrc} alt="" width={30} height={30} />
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-wide text-white">
                {copy.brand.short}
              </span>
              <span className="block text-[11px] font-medium text-white/50">
                {copy.brand.academy}
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-semibold text-white/85 backdrop-blur transition hover:bg-white/14 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {copy.auth.backToLanding}
          </Link>
        </header>

        <div className="auth-enter-delay flex flex-1 flex-col justify-center py-10">
          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FDAD3E]/90">
              {copy.brand.short}
            </p>
            <h1
              className="mt-2 font-extrabold tracking-[-0.035em] text-white"
              style={{ fontSize: "clamp(2rem, 6vw, 2.75rem)" }}
            >
              {title}
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">{subtitle}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white p-5 text-primary shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)] sm:p-7">
            {children}
          </div>

          {footer ? <div className="mt-5 text-center text-sm text-white/55">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

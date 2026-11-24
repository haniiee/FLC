"use client";

import { BookOpen, Headphones, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { landingCopy } from "../../lib/landing-copy";
import { LandingInstallSection } from "./LandingInstallSection";

const ICONS = {
  bookOpen: BookOpen,
  headphones: Headphones,
  messages: MessagesSquare,
} as const;

export function LandingCta() {
  const { cta } = landingCopy;

  return (
    <section className="relative z-20 bg-[#F6F7FB] pb-[max(4rem,env(safe-area-inset-bottom))] pt-8 text-primary sm:pt-10 [[data-hero=cover]_&]:-mt-28 [[data-hero=cover]_&]:bg-gradient-to-b [[data-hero=cover]_&]:from-transparent [[data-hero=cover]_&]:via-[#E8ECF7]/95 [[data-hero=cover]_&]:to-[#F6F7FB] [[data-hero=cover]_&]:pb-16 [[data-hero=cover]_&]:pt-36">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-8">
        <h2
          className="max-w-3xl text-balance font-extrabold tracking-[-0.035em] text-primary"
          style={{ fontSize: "clamp(1.75rem, 5vw, 3.75rem)" }}
        >
          {cta.title}
        </h2>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {cta.features.map((feature) => {
            const Icon = ICONS[feature.icon];
            return (
              <article
                key={feature.id}
                className="group rounded-2xl border border-primary/8 bg-white p-5 shadow-[0_18px_50px_-32px_rgba(15,30,74,0.35)] transition duration-300 hover:-translate-y-1 hover:border-[#FDAD3E]/45 hover:shadow-[0_24px_55px_-28px_rgba(15,30,74,0.4)]"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-[#FDAD3E]">
                  <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-primary">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap sm:mt-10">
          <Link
            href="/register"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FDAD3E] px-6 py-3 text-sm font-bold text-[#1A1205] transition hover:brightness-105 min-[420px]:w-auto"
          >
            {cta.join}
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-primary/15 bg-white px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary-soft min-[420px]:w-auto"
          >
            {cta.signIn}
          </Link>
        </div>

        <LandingInstallSection />

        <footer className="mt-16 border-t border-primary/10 pt-6 text-xs text-text-muted">
          {cta.footer}
        </footer>
      </div>
    </section>
  );
}

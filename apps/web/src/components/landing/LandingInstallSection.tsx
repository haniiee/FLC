"use client";

import { Share } from "lucide-react";
import { useEffect, useState } from "react";
import { copy } from "../../lib/copy";
import { landingCopy } from "../../lib/landing-copy";
import { Sheet } from "../ui/Sheet";

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor">
      <path d="M16.37 1.43c0 1.14-.42 2.22-1.17 3.03-.84.9-1.85 1.52-2.96 1.43-.14-1.12.4-2.28 1.14-3.05.82-.86 2.2-1.5 2.99-1.41zm3.96 14.55c-.62 1.38-.91 2-1.7 3.22-.87 1.35-2.1 3.03-3.62 3.06-1.35.03-1.7-.88-3.54-.87-1.85.01-2.24.89-3.6.86-1.52-.03-2.68-1.54-3.55-2.89-2.43-3.76-2.68-8.17-1.19-10.51 1.06-1.66 2.73-2.63 4.3-2.66 1.35-.03 2.62.91 3.54.91.9 0 2.58-1.13 4.35-.96.74.03 2.82.3 4.16 2.26-3.61 1.98-3.03 7.14.85 8.58z" />
    </svg>
  );
}

function AndroidMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor">
      <path d="M17.6 9.48 19.44 6.3a.637.637 0 0 0-1.13-.59l-1.86 3.22a11.45 11.45 0 0 0-8.9 0L5.69 5.71a.637.637 0 0 0-1.13.59L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

export function LandingInstallSection() {
  const { installSection } = landingCopy;
  const [iphoneOpen, setIphoneOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const androidUrl =
    (process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? "").trim() || "/downloads/flc.apk";

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (isIos()) setPlatform("ios");
    else if (isAndroid()) setPlatform("android");
  }, []);

  if (installed) {
    return null;
  }

  const iphoneActive = platform === "ios";
  const androidActive = platform === "android";

  return (
    <section className="mt-12 overflow-hidden rounded-3xl border border-primary/10 bg-white p-5 shadow-[0_22px_60px_-36px_rgba(15,30,74,0.35)] sm:mt-16 sm:p-8">
      <div className="max-w-2xl">
        <h3
          className="font-extrabold tracking-[-0.03em] text-primary"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)" }}
        >
          {installSection.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-text-muted sm:text-base">{installSection.body}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <article
          className={`flex flex-col rounded-2xl border p-4 sm:p-5 ${
            iphoneActive ? "border-[#FDAD3E] bg-[#FFF8EE]" : "border-primary/10 bg-[#F6F7FB]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary shadow-[0_8px_20px_-14px_rgba(15,30,74,0.6)]">
              <AppleMark />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                {installSection.iphone.kicker}
              </p>
              <h4 className="text-base font-bold text-primary">{installSection.iphone.title}</h4>
            </div>
          </div>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{installSection.iphone.body}</p>
          <button
            type="button"
            onClick={() => setIphoneOpen(true)}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-primary/15 bg-white px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary-soft"
          >
            <Share className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            {installSection.iphone.cta}
          </button>
        </article>

        <article
          className={`flex flex-col rounded-2xl border p-4 sm:p-5 ${
            androidActive ? "border-[#FDAD3E] bg-[#FFF8EE]" : "border-primary/10 bg-[#F6F7FB]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#3DDC84] shadow-[0_8px_20px_-14px_rgba(15,30,74,0.6)]">
              <AndroidMark />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                {installSection.android.kicker}
              </p>
              <h4 className="text-base font-bold text-primary">{installSection.android.title}</h4>
            </div>
          </div>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{installSection.android.body}</p>
          <a
            href={androidUrl}
            download={androidUrl.endsWith(".apk") ? "flc.apk" : undefined}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FDAD3E] px-5 py-3 text-sm font-bold text-[#1A1205] transition hover:brightness-105"
          >
            <AndroidMark />
            {installSection.android.cta}
          </a>
        </article>
      </div>

      <Sheet
        open={iphoneOpen}
        onClose={() => setIphoneOpen(false)}
        title={installSection.iphone.sheetTitle}
      >
        <div className="space-y-4 text-sm text-text">
          <ol className="space-y-2">
            {installSection.iphone.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-text-muted">{copy.install.body}</p>
          <button
            type="button"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            onClick={() => setIphoneOpen(false)}
          >
            {copy.install.gotIt}
          </button>
        </div>
      </Sheet>
    </section>
  );
}

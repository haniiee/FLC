"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { copy } from "../../lib/copy";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

const DISMISS_KEY = "flc:install-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      return false;
    }
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const onHome = pathname === "/";

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) {
      return;
    }

    if (isIos()) {
      if (onHome) {
        setShowIos(true);
      }
      return;
    }

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      if (onHome) {
        setShowAndroid(true);
      }
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [onHome]);

  if (isStandalone() || !onHome) {
    return null;
  }

  async function installAndroid() {
    if (!deferred) {
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShowAndroid(false);
    dismiss();
  }

  function closeAndroid() {
    setShowAndroid(false);
    dismiss();
  }

  function closeIos() {
    setShowIos(false);
    dismiss();
  }

  return (
    <>
      {showAndroid && deferred ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
          <div className="mx-auto flex max-w-[720px] items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">{copy.install.title}</p>
              <p className="text-xs text-text-muted">{copy.install.body}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={closeAndroid}
            >
              {copy.install.later}
            </Button>
            <Button
              type="button"
              className="px-3 py-2 text-sm"
              onClick={() => void installAndroid()}
            >
              {copy.install.install}
            </Button>
          </div>
        </div>
      ) : null}

      <Sheet open={showIos} onClose={closeIos} title={copy.install.title}>
        <div className="space-y-3 text-sm text-text">
          <p>{copy.install.iosHint}</p>
          <p className="text-text-muted">{copy.install.body}</p>
          <Button type="button" className="w-full" onClick={closeIos}>
            {copy.install.gotIt}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { copy } from "../../lib/copy";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

const DISMISS_KEY = "flc:install-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

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
  const [showIos, setShowIos] = useState(false);
  const onHome = pathname === "/";

  useEffect(() => {
    if (!onHome || isStandalone() || wasDismissedRecently() || !isIos()) {
      return;
    }
    setShowIos(true);
  }, [onHome]);

  if (!onHome || isStandalone() || !showIos) {
    return null;
  }

  function closeIos() {
    setShowIos(false);
    dismiss();
  }

  return (
    <Sheet open={showIos} onClose={closeIos} title={copy.install.title}>
      <div className="space-y-3 text-sm text-text">
        <p>{copy.install.iosHint}</p>
        <p className="text-text-muted">{copy.install.body}</p>
        <Button type="button" className="w-full" onClick={closeIos}>
          {copy.install.gotIt}
        </Button>
      </div>
    </Sheet>
  );
}

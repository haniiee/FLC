"use client";

import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { copy } from "../lib/copy";

export function SerwistProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const onUpdateFound = (registration: ServiceWorkerRegistration) => {
      const worker = registration.installing;
      if (!worker) {
        return;
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          toast(copy.pwa.updateReady, {
            action: {
              label: copy.pwa.reload,
              onClick: () => window.location.reload(),
            },
            duration: 12_000,
          });
        }
      });
    };

    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) {
        return;
      }
      registration.addEventListener("updatefound", () => onUpdateFound(registration));
      if (registration.installing) {
        onUpdateFound(registration);
      }
    });
  }, []);

  return children;
}

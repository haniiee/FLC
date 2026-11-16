"use client";

import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

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
          toast("نسخه‌ی جدید آماده‌ست — بارگذاری مجدد", {
            action: {
              label: "بارگذاری",
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
      // In case an update is already installing
      if (registration.installing) {
        onUpdateFound(registration);
      }
    });
  }, []);

  return children;
}

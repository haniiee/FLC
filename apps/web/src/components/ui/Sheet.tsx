"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="بستن"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] w-full max-w-[720px] overflow-y-auto rounded-t-2xl bg-background p-4 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        {title ? <h3 className="mb-3 text-base font-semibold text-secondary">{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}

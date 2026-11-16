"use client";

import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-text">{label}</span> : null}
      <input
        className={clsx(
          "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-text outline-none transition focus:border-secondary",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

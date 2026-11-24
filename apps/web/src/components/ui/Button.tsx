"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "outline";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-dark shadow-card",
  secondary: "bg-secondary text-white hover:bg-secondary-light shadow-card",
  accent: "bg-accent text-accent-on hover:brightness-105 shadow-card",
  outline: "border border-border bg-surface text-primary hover:bg-surface-muted",
  ghost: "bg-transparent text-primary hover:bg-primary-soft",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}

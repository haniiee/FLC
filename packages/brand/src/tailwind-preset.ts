import type { Config } from "tailwindcss";
import { tokens } from "./tokens";

const spacingScale = Object.fromEntries(
  Object.entries(tokens.spacing).map(([key, value]) => [key, `${value}px`]),
);

const brandPreset = {
  content: [],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: tokens.colors.primary,
          dark: tokens.colors.primaryDark,
          soft: tokens.colors.primarySoft,
        },
        secondary: {
          DEFAULT: tokens.colors.secondary,
          light: tokens.colors.secondaryLight,
        },
        background: tokens.colors.background,
        surface: tokens.colors.surface,
        border: tokens.colors.border,
        text: {
          DEFAULT: tokens.colors.text,
          muted: tokens.colors.textMuted,
        },
        "on-primary": tokens.colors.onPrimary,
        danger: tokens.colors.danger,
        success: tokens.colors.success,
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        full: `${tokens.radius.full}px`,
      },
      spacing: spacingScale,
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "Segoe UI", "sans-serif"],
      },
    },
  },
} satisfies Config;

export default brandPreset;

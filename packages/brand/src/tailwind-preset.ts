import type { Config } from "tailwindcss";
import { tokens } from "./tokens";

const spacingScale = Object.fromEntries(
  Object.entries(tokens.spacing).map(([key, value]) => [key, `${value}px`]),
);

const light = tokens.themes.light;

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
        accent: {
          DEFAULT: light.accent,
          on: light.onAccent,
        },
        background: tokens.colors.background,
        surface: {
          DEFAULT: tokens.colors.surface,
          muted: light.surfaceMuted,
        },
        border: tokens.colors.border,
        text: {
          DEFAULT: tokens.colors.text,
          muted: tokens.colors.textMuted,
        },
        "on-primary": tokens.colors.onPrimary,
        hero: {
          from: light.heroFrom,
          to: light.heroTo,
        },
        info: light.info,
        warning: light.warning,
        danger: tokens.colors.danger,
        success: tokens.colors.success,
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        xl: `${tokens.radius.xl}px`,
        full: `${tokens.radius.full}px`,
      },
      spacing: spacingScale,
      boxShadow: {
        card: "0 6px 16px rgba(11, 20, 51, 0.06)",
        soft: "0 10px 30px rgba(15, 30, 74, 0.08)",
      },
      fontFamily: {
        sans: [
          "var(--font-jakarta)",
          "Plus Jakarta Sans",
          "var(--font-vazirmatn)",
          "Vazirmatn",
          "system-ui",
          "sans-serif",
        ],
      },
      backgroundImage: {
        "hero-navy": `linear-gradient(135deg, ${light.heroFrom} 0%, ${light.heroTo} 100%)`,
      },
    },
  },
} satisfies Config;

export default brandPreset;

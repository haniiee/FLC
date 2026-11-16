export const tokens = {
  colors: {
    primary: "#FDAD3E",
    primaryDark: "#E8952A",
    primarySoft: "#FFF4E3",
    secondary: "#064F47",
    secondaryLight: "#368880",
    background: "#FFFFFF",
    surface: "#F7F7F5",
    border: "#E6E6E6",
    text: "#1A1A1A",
    textMuted: "#6B6B6B",
    onPrimary: "#FFFFFF",
    danger: "#D64545",
    success: "#2E9E6A",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 20,
    full: 9999,
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  font: {
    sans: '"Vazirmatn", "Tahoma", "Segoe UI", sans-serif',
    latinFallback: '"Segoe UI", system-ui, sans-serif',
  },
} as const;

export type Tokens = typeof tokens;

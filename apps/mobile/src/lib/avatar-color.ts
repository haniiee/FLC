import { contrastRatio, tokens } from "@app/brand";

/** Avoid #0F1E4A — it disappears on dark surfaces. */
const PALETTE = [
  tokens.palette.navy[600],
  tokens.palette.navy[500],
  tokens.palette.navy[700],
  tokens.themes.light.accent,
  tokens.themes.light.info,
  tokens.themes.light.success,
  tokens.palette.amber[500],
  tokens.palette.navy[400],
] as const;

const INK_LIGHT = "#FFFFFF";
const INK_DARK = "#0B1433";

/** Deterministic background color from a display name. */
export function avatarColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}

/** Pick white or navy ink based on which contrasts better with the background. */
export function contrastingInk(background: string): string {
  const light = contrastRatio(INK_LIGHT, background);
  const dark = contrastRatio(INK_DARK, background);
  return light >= dark ? INK_LIGHT : INK_DARK;
}

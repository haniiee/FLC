import { tokens } from "@app/brand";
import type { TextVariant } from "../theme/typography";

const HEADING_VARIANTS = new Set<TextVariant>(["display", "h1", "h2", "h3"]);

/** Extra line-height / zero tracking so Persian display glyphs are not clipped. */
export function persianHeadingMetrics(
  variant: TextVariant,
  persian: boolean,
): { lineHeight: number; letterSpacing: number } | null {
  if (!persian || !HEADING_VARIANTS.has(variant)) return null;
  const size = tokens.typography[variant].size;
  return { lineHeight: size * 1.45, letterSpacing: 0 };
}

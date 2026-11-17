import { contrastRatio, tokens } from "@app/brand";
import { describe, expect, it } from "vitest";

describe("contrastRatio AA checks", () => {
  for (const mode of ["light", "dark"] as const) {
    const theme = tokens.themes[mode];
    it(`${mode}: text / bg >= 4.5`, () => {
      expect(contrastRatio(theme.text, theme.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: textMuted / bg >= 4.5`, () => {
      expect(contrastRatio(theme.textMuted, theme.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: onPrimary / primary >= 4.5`, () => {
      expect(contrastRatio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: onAccent / accent >= 4.5`, () => {
      expect(contrastRatio(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: onHero / heroFrom >= 4.5`, () => {
      expect(contrastRatio(theme.onHero, theme.heroFrom)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: onHero / heroTo >= 4.5`, () => {
      expect(contrastRatio(theme.onHero, theme.heroTo)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

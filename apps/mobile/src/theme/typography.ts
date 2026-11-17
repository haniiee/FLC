import { tokens } from "@app/brand";
import type { TextStyle } from "react-native";

export type TextVariant = keyof typeof tokens.typography;

export const fontFamilies = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
  persianRegular: "Vazirmatn_400Regular",
  persianMedium: "Vazirmatn_500Medium",
  persianBold: "Vazirmatn_700Bold",
} as const;

function weightToFamily(weight: string, persian: boolean): string {
  if (persian) {
    if (weight === "700" || weight === "800") return fontFamilies.persianBold;
    if (weight === "500" || weight === "600") return fontFamilies.persianMedium;
    return fontFamilies.persianRegular;
  }
  switch (weight) {
    case "800":
      return fontFamilies.extraBold;
    case "700":
      return fontFamilies.bold;
    case "600":
      return fontFamilies.semiBold;
    case "500":
      return fontFamilies.medium;
    default:
      return fontFamilies.regular;
  }
}

export function typographyStyle(variant: TextVariant, persian = false): TextStyle {
  const spec = tokens.typography[variant];
  return {
    fontFamily: weightToFamily(spec.weight, persian),
    fontSize: spec.size,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    fontWeight: spec.weight,
  };
}

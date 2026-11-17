import { View } from "react-native";
import { tokens } from "@app/brand";
import { useTheme } from "../theme/theme";
import { AppText } from "./AppText";

type ChipVariant = "neutral" | "primary" | "accent" | "success";

type ChipProps = {
  label: string;
  variant?: ChipVariant;
};

export function Chip({ label, variant = "neutral" }: ChipProps) {
  const { colors } = useTheme();
  const palette = (() => {
    switch (variant) {
      case "accent":
        return { bg: colors.accent, fg: "onAccent" as const };
      case "primary":
        return { bg: colors.primarySoft, fg: "primary" as const };
      case "success":
        return { bg: `${colors.success}22`, fg: "text" as const };
      default:
        return { bg: colors.surfaceMuted, fg: "textMuted" as const };
    }
  })();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: palette.bg,
        borderRadius: tokens.radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <AppText
        variant="caption"
        color={palette.fg}
        style={variant === "success" ? { color: colors.success } : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

export function roleChipVariant(role: "teacher" | "assistant" | "student"): ChipVariant {
  if (role === "teacher") return "accent";
  if (role === "assistant") return "primary";
  return "neutral";
}

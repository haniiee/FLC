import { useMemo, type ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { persianHeadingMetrics } from "../lib/persian-typography";
import { hasPersian } from "../lib/script";
import { useTheme } from "../theme/theme";
import { typographyStyle, type TextVariant } from "../theme/typography";

type AppTextColor =
  | "text"
  | "textMuted"
  | "primary"
  | "onPrimary"
  | "accent"
  | "danger"
  | "onAccent"
  | "onHero"
  | "onHeroMuted";

type AppTextProps = TextProps & {
  children?: ReactNode;
  variant?: TextVariant;
  color?: AppTextColor;
  persian?: boolean;
};

export function AppText({
  children,
  variant = "body",
  color = "text",
  persian,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const asString = typeof children === "string" ? children : "";
  const usePersian = persian ?? (asString ? hasPersian(asString) : false);
  const base = useMemo(() => {
    const styleBase = typographyStyle(variant, usePersian);
    const persianAdjust = persianHeadingMetrics(variant, usePersian);
    return persianAdjust ? { ...styleBase, ...persianAdjust } : styleBase;
  }, [variant, usePersian]);

  return (
    <Text style={[base, { color: colors[color] } as TextStyle, style]} {...rest}>
      {children}
    </Text>
  );
}

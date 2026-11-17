import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { tokens } from "@app/brand";
import { useTheme } from "../theme/theme";

type GradientHeroProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function GradientHero({ children, style }: GradientHeroProps) {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={[colors.heroFrom, colors.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: tokens.radius.xl,
          padding: 20,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: "rgba(255,255,255,0.08)",
          top: -40,
          end: -30,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "rgba(255,255,255,0.06)",
          bottom: -20,
          start: -10,
        }}
      />
      {children}
    </LinearGradient>
  );
}

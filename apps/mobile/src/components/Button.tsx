import * as Haptics from "expo-haptics";
import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme/theme";
import { AppText } from "./AppText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
type ButtonSize = "md" | "lg";

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  size = "md",
  leftIcon,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const edge = useSharedValue(3);

  const height = size === "lg" ? 56 : 48;
  const isDisabled = Boolean(disabled || loading);
  const showEdge = !isDisabled && (variant === "primary" || variant === "accent");

  const palette = (() => {
    switch (variant) {
      case "primary":
        return {
          bg: colors.primary,
          text: "onPrimary" as const,
          edge: colors.primaryPressed,
          border: "transparent",
        };
      case "accent":
        return {
          bg: colors.accent,
          text: "onAccent" as const,
          edge: colors.warning,
          border: "transparent",
        };
      case "secondary":
        return {
          bg: colors.primarySoft,
          text: "primary" as const,
          edge: colors.border,
          border: "transparent",
        };
      case "outline":
        return {
          bg: "transparent",
          text: "primary" as const,
          edge: "transparent",
          border: colors.border,
        };
      case "ghost":
        return {
          bg: "transparent",
          text: "primary" as const,
          edge: "transparent",
          border: "transparent",
        };
      case "danger":
        return {
          bg: "transparent",
          text: "danger" as const,
          edge: "transparent",
          border: colors.danger,
        };
    }
  })();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const edgeStyle = useAnimatedStyle(() => ({
    height: edge.value,
    backgroundColor: palette.edge,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={isDisabled}
      hitSlop={4}
      onPress={() => {
        if (isDisabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => {
        if (isDisabled) return;
        scale.value = withSpring(0.97, { damping: 18, stiffness: 220 });
        translateY.value = withSpring(2, { damping: 18, stiffness: 220 });
        if (variant === "primary" || variant === "accent") {
          edge.value = withSpring(0, { damping: 18, stiffness: 220 });
        }
      }}
      onPressOut={() => {
        if (isDisabled) return;
        scale.value = withSpring(1, { damping: 14, stiffness: 180 });
        translateY.value = withSpring(0, { damping: 14, stiffness: 180 });
        edge.value = withSpring(3, { damping: 14, stiffness: 180 });
      }}
      style={[
        animatedStyle,
        {
          minHeight: height,
          borderRadius: 14,
          backgroundColor: palette.bg,
          borderWidth: variant === "outline" || variant === "danger" ? 1.5 : 0,
          borderColor: palette.border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 18,
          opacity: isDisabled ? 0.45 : 1,
          overflow: "hidden",
        } satisfies ViewStyle,
      ]}
    >
      {showEdge ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
            },
            edgeStyle,
          ]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors[palette.text]} />
      ) : (
        <>
          {leftIcon}
          <AppText variant="label" color={palette.text}>
            {title}
          </AppText>
        </>
      )}
    </AnimatedPressable>
  );
}

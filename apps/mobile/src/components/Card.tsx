import { type ReactNode } from "react";
import { Pressable, View, type ViewProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { tokens } from "@app/brand";
import { useTheme } from "../theme/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardProps = ViewProps & {
  children: ReactNode;
  pressable?: boolean;
  onPress?: () => void;
  padding?: 16 | 20;
  accessibilityLabel?: string;
};

export function Card({
  children,
  style,
  pressable,
  onPress,
  padding = 16,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const { colors, isDark, cardShadow } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const baseStyle: ViewStyle = {
    backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
    borderRadius: tokens.radius.lg,
    padding,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    ...(cardShadow ?? {}),
  };

  if (pressable && onPress) {
    return (
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={4}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 16, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 180 });
        }}
        style={[animatedStyle, baseStyle, style]}
        {...rest}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[baseStyle, style]} {...rest}>
      {children}
    </View>
  );
}

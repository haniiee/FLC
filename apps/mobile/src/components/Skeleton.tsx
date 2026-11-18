import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/theme";
import { Card } from "./Card";

function ShimmerBlock({
  height,
  width = "100%",
  radius = 10,
}: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}
    />
  );
}

export function ClassCardSkeleton() {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ShimmerBlock height={48} width={48} radius={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <ShimmerBlock height={16} width="70%" />
          <ShimmerBlock height={12} width="40%" />
        </View>
      </View>
    </Card>
  );
}

export function ClassesSkeletonList() {
  return (
    <View style={{ gap: 12, paddingHorizontal: 16 }}>
      <ClassCardSkeleton />
      <ClassCardSkeleton />
      <ClassCardSkeleton />
    </View>
  );
}

export function SessionCardSkeleton() {
  return (
    <Card>
      <View style={{ gap: 8 }}>
        <ShimmerBlock height={16} width="60%" />
        <ShimmerBlock height={12} width="45%" />
      </View>
    </Card>
  );
}

export function SessionsSkeletonList() {
  return (
    <View style={{ gap: 12 }}>
      <SessionCardSkeleton />
      <SessionCardSkeleton />
      <SessionCardSkeleton />
    </View>
  );
}

export function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
      <ClassesSkeletonList />
    </View>
  );
}

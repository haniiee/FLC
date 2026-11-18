import { RotateCcw } from "lucide-react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";
import { AppText } from "../components/AppText";
import { useTheme } from "../theme/theme";
import { MINI_PLAYER_HEIGHT } from "./types";

const TAB_BAR_BASE = 62;

type ResumeToastProps = {
  message: string;
};

export function ResumeToast({ message }: ResumeToastProps) {
  const { colors, spacing, cardShadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const onTabs = segments.includes("(tabs)");
  const hideMini = segments.includes("player");
  const bottomOffset = onTabs
    ? TAB_BAR_BASE + Math.max(insets.bottom, 0)
    : Math.max(insets.bottom, 8);
  const bottom =
    bottomOffset + spacing[2] + (hideMini ? spacing[4] : MINI_PLAYER_HEIGHT + spacing[3]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      style={{
        position: "absolute",
        alignSelf: "center",
        bottom,
        maxWidth: "86%",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2] + 2,
        borderRadius: 999,
        backgroundColor: colors.surfaceElevated,
        borderWidth: isDark ? 1 : 0,
        borderColor: colors.border,
        zIndex: 100,
        elevation: 8,
        ...(cardShadow ?? {}),
      }}
    >
      <RotateCcw size={14} color={colors.primary} />
      <AppText variant="caption" accessibilityLabel={message}>
        {message}
      </AppText>
    </Animated.View>
  );
}

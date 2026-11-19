import { Pause, Play, SkipForward } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";
import { AppText } from "../components/AppText";
import { useTheme } from "../theme/theme";
import { usePlayerOptional, usePlayerProgress } from "./context";
import { MINI_PLAYER_HEIGHT } from "./types";

const TAB_BAR_BASE = 62;

export function MiniPlayer() {
  const player = usePlayerOptional();
  const { colors, spacing, cardShadow } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];

  if (!player?.queue.length || !player.current) {
    return null;
  }

  // Hide on the full player modal itself, and while hold-to-record overlay is up.
  if (segments.includes("player") || player.isRecordingOverlay) {
    return null;
  }

  const onTabs = segments.includes("(tabs)");
  const bottomOffset = onTabs
    ? TAB_BAR_BASE + Math.max(insets.bottom, 0)
    : Math.max(insets.bottom, 8);

  return (
    <View
      style={{
        position: "absolute",
        left: spacing[3],
        right: spacing[3],
        bottom: bottomOffset + spacing[2],
        borderRadius: 16,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        zIndex: 50,
        ...(cardShadow ?? {}),
      }}
    >
      <MiniPlayerProgress color={colors.primary} trackColor={colors.border} />
      <View
        style={{
          minHeight: MINI_PLAYER_HEIGHT - 3,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing[3],
          gap: spacing[2],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open player"
          onPress={player.openFullPlayer}
          style={{ flex: 1, gap: 2 }}
        >
          <AppText variant="label" numberOfLines={1}>
            {player.current.displayName}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {player.current.topicDisplayName || player.current.sessionDisplayName}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={player.isPlaying ? "Pause" : "Play"}
          hitSlop={8}
          onPress={player.toggle}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {player.isPlaying ? (
            <Pause size={18} color={colors.onPrimary} fill={colors.onPrimary} />
          ) : (
            <Play
              size={18}
              color={colors.onPrimary}
              fill={colors.onPrimary}
              style={{ marginLeft: 2 }}
            />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next"
          hitSlop={8}
          onPress={player.next}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SkipForward size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function MiniPlayerProgress({ color, trackColor }: { color: string; trackColor: string }) {
  const { position, duration } = usePlayerProgress();
  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  return (
    <View style={{ height: 3, backgroundColor: trackColor }}>
      <View
        style={{
          height: 3,
          width: `${progress * 100}%`,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function useMiniPlayerPadding(): number {
  const player = usePlayerOptional();
  if (!player?.queue.length) return 0;
  return MINI_PLAYER_HEIGHT + 16;
}

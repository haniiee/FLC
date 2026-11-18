import {
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../components/AppText";
import { GradientHero } from "../../components/GradientHero";
import { Screen } from "../../components/Screen";
import { SeekBar } from "../../components/SeekBar";
import { copy } from "../../lib/copy";
import { formatClock, upNextItems } from "../../player/logic";
import { usePlayer } from "../../player/context";
import { useTheme } from "../../theme/theme";

function RepeatIcon({ mode }: { mode: "off" | "all" | "one" }) {
  const { colors } = useTheme();
  if (mode === "one") {
    return <Repeat1 size={22} color={colors.primary} />;
  }
  if (mode === "all") {
    return (
      <View>
        <Repeat size={22} color={colors.primary} />
        <View
          style={{
            position: "absolute",
            right: -2,
            top: -2,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.accent,
          }}
        />
      </View>
    );
  }
  return <Repeat size={22} color={colors.textMuted} />;
}

function upNextLabelText(label: ReturnType<typeof upNextItems>["label"]): string | null {
  if (label === "end-of-queue") return copy.content.endOfQueue;
  if (label === "repeating-this-track") return "Repeating this track";
  if (label === "repeats-from-start") return "Repeats from start";
  return null;
}

export default function FullPlayerScreen() {
  const player = usePlayer();
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const current = player.current;

  const upNext = upNextItems(player.queue, player.index, player.repeat);
  const emptyLabel = upNextLabelText(upNext.label);

  return (
    <Screen padded={false} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing[3],
          paddingTop: spacing[1],
          paddingBottom: spacing[2],
          minHeight: 48,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close player"
          hitSlop={8}
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceMuted,
          }}
        >
          <ChevronDown size={22} color={colors.text} />
        </Pressable>
        <AppText
          variant="label"
          style={{ flex: 1, textAlign: "center", marginRight: 40 }}
          accessibilityRole="header"
        >
          Now playing
        </AppText>
      </View>

      {!current ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppText variant="body" color="textMuted">
            {copy.content.nothingPlaying}
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingBottom: insets.bottom + spacing[8],
            gap: spacing[4],
          }}
        >
          <View accessibilityLabel="Album artwork">
            <GradientHero
              style={{
                borderRadius: 24,
                minHeight: 220,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText variant="display" color="onHero" style={{ opacity: 0.9 }}>
                FLC
              </AppText>
            </GradientHero>
          </View>

          <View style={{ gap: spacing[1] }}>
            <AppText variant="h1" accessibilityLabel={`Title ${current.displayName}`}>
              {current.displayName}
            </AppText>
            <AppText variant="body" color="textMuted">
              {current.topicDisplayName
                ? `${current.sessionDisplayName} · ${current.topicDisplayName}`
                : current.sessionDisplayName}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {current.groupDisplayName}
            </AppText>
          </View>

          <View style={{ gap: spacing[2] }}>
            <View accessibilityLabel="Seek">
              <SeekBar
                value={Math.min(player.position, Math.max(player.duration, 1))}
                maximumValue={Math.max(player.duration, 1)}
                onSlidingComplete={(value) => {
                  void player.seekTo(value);
                }}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="caption" color="textMuted" accessibilityLabel="Current time">
                {formatClock(player.position)}
              </AppText>
              <AppText variant="caption" color="textMuted" accessibilityLabel="Duration">
                {formatClock(player.duration)}
              </AppText>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[5],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous"
              hitSlop={8}
              onPress={player.previous}
            >
              <SkipBack size={28} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={player.isPlaying ? "Pause" : "Play"}
              onPress={player.toggle}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {player.isPlaying ? (
                <Pause size={30} color={colors.onPrimary} fill={colors.onPrimary} />
              ) : (
                <Play
                  size={30}
                  color={colors.onPrimary}
                  fill={colors.onPrimary}
                  style={{ marginLeft: 3 }}
                />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next"
              hitSlop={8}
              onPress={player.next}
            >
              <SkipForward size={28} color={colors.text} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing[2],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Repeat ${player.repeat}`}
              onPress={player.cycleRepeat}
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RepeatIcon mode={player.repeat} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Speed ${player.rate}x`}
              onPress={player.cycleSpeed}
              style={{
                minWidth: 64,
                height: 40,
                borderRadius: 20,
                paddingHorizontal: spacing[3],
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText variant="label" color="primary">
                {`${player.rate}×`}
              </AppText>
            </Pressable>
          </View>

          <View style={{ gap: spacing[3] }}>
            <AppText variant="h2">{copy.content.upNext}</AppText>
            {upNext.label === "repeats-from-start" ? (
              <AppText variant="caption" color="accent">
                Repeats from start
              </AppText>
            ) : null}
            {upNext.rows.length === 0 ? (
              emptyLabel && upNext.label !== "repeats-from-start" ? (
                <AppText variant="body" color="textMuted">
                  {emptyLabel}
                </AppText>
              ) : null
            ) : (
              upNext.rows.map((row) => {
                const durationSec =
                  row.item.durationMs && row.item.durationMs > 0 ? row.item.durationMs / 1000 : 0;
                return (
                  <Pressable
                    key={`${row.index}-${row.item.fileId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${row.item.displayName}`}
                    hitSlop={6}
                    onPress={() => player.playIndex(row.index)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[3],
                      paddingVertical: spacing[2],
                      paddingHorizontal: spacing[2],
                      marginHorizontal: -spacing[2],
                      borderRadius: 12,
                      backgroundColor: pressed
                        ? isDark
                          ? colors.surfaceElevated
                          : colors.surfaceMuted
                        : "transparent",
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <AppText
                      variant="caption"
                      color="textMuted"
                      style={{ width: 28, textAlign: "center" }}
                    >
                      {row.number}
                    </AppText>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="label">{row.item.displayName}</AppText>
                      <AppText variant="caption" color="textMuted">
                        {row.item.topicDisplayName || row.item.sessionDisplayName}
                      </AppText>
                    </View>
                    {durationSec > 0 ? (
                      <AppText variant="caption" color="textMuted">
                        {formatClock(durationSec)}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

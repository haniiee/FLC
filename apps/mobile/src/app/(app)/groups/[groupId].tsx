import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar, setStatusBarStyle } from "expo-status-bar";
import { ArrowLeft, BookOpen } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../components/AppText";
import { Chip, roleChipVariant } from "../../../components/Chip";
import { EmptyState } from "../../../components/EmptyState";
import { GradientHero } from "../../../components/GradientHero";
import { Screen } from "../../../components/Screen";
import { LoadingScreen } from "../../../components/Skeleton";
import { getApiClient } from "../../../lib/api";
import { copy } from "../../../lib/copy";
import { roleLabel } from "../../../lib/format";
import { useTheme } from "../../../theme/theme";

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => {
        setStatusBarStyle(isDark ? "light" : "dark");
      };
    }, [isDark]),
  );

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId),
    enabled: Boolean(groupId),
  });

  if (groupQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (!groupQuery.data) {
    return (
      <Screen>
        <EmptyState icon={BookOpen} title={copy.group.notFound} />
      </Screen>
    );
  }

  const group = groupQuery.data;

  return (
    <Screen padded={false} edges={[]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <GradientHero
          style={{
            borderRadius: 0,
            paddingTop: insets.top + 64,
            paddingBottom: 28,
            paddingHorizontal: 20,
            minHeight: 220,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.a11y.back}
            hitSlop={8}
            onPress={() => router.back()}
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <ArrowLeft size={20} color={colors.onHero} />
          </Pressable>
          <View style={{ gap: 12 }}>
            <AppText variant="display" color="onHero">
              {group.name}
            </AppText>
            <Chip label={roleLabel(group.myRole)} variant={roleChipVariant(group.myRole)} />
          </View>
        </GradientHero>

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 8 }}>
          <AppText variant="h2">{copy.group.sessions}</AppText>
          <View
            style={{
              minHeight: 280,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <EmptyState
              icon={BookOpen}
              title={copy.group.sessionsComing}
              subtitle={copy.group.sessionsComingSubtitle}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

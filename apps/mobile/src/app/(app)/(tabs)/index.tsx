import type { GroupSummary } from "@app/shared-types";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChevronRight, GraduationCap } from "lucide-react-native";
import { useRef } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppText } from "../../../components/AppText";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Chip, roleChipVariant } from "../../../components/Chip";
import { EmptyState } from "../../../components/EmptyState";
import { GradientHero } from "../../../components/GradientHero";
import { Screen } from "../../../components/Screen";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { ClassesSkeletonList } from "../../../components/Skeleton";
import { getApiClient } from "../../../lib/api";
import { avatarColorFromName, contrastingInk } from "../../../lib/avatar-color";
import { copy } from "../../../lib/copy";
import { firstName, initials, roleLabel } from "../../../lib/format";
import { useTabScrollToTop } from "../../../lib/use-tab-scroll-to-top";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useAuth } from "../../../providers/auth-provider";
import { useTheme } from "../../../theme/theme";

function ClassRow({
  item,
  index,
  reduceMotion,
}: {
  item: GroupSummary;
  index: number;
  reduceMotion: boolean;
}) {
  const { colors, isDark } = useTheme();
  const tileBg = avatarColorFromName(item.name);
  const tileInk = contrastingInk(tileBg);
  const content = (
    <Card
      pressable
      accessibilityLabel={item.name}
      onPress={() => router.push(`/groups/${item.id}`)}
      style={{ marginBottom: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: tileBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: isDark ? 1 : 0,
            borderColor: colors.border,
          }}
        >
          <AppText variant="label" style={{ color: tileInk }}>
            {initials(item.name)}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="h3">{item.name}</AppText>
          <Chip label={roleLabel(item.myRole)} variant={roleChipVariant(item.myRole)} />
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
    </Card>
  );

  if (reduceMotion || index > 7) return content;
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>{content}</Animated.View>
  );
}

export default function ClassesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const miniPad = useMiniPlayerPadding();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlatList>(null);
  useTabScrollToTop(listRef);

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => getApiClient().listGroups(),
  });

  const groups = groupsQuery.data?.groups ?? [];
  const isTeacher = user?.platformRole === "teacher";

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader
        title={copy.classes.hi(firstName(user?.displayName ?? "there"))}
        subtitle={copy.classes.yourClasses}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.a11y.openProfile}
            hitSlop={8}
            onPress={() => router.push("/profile")}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Avatar name={user?.displayName ?? "U"} size={40} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <GradientHero>
          {isTeacher ? (
            <View style={{ gap: 4 }}>
              <AppText variant="display" color="onHero">
                {String(groups.length)}
              </AppText>
              <AppText variant="body" color="onHeroMuted">
                {copy.classes.teachCount(groups.length)}
              </AppText>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <AppText variant="h2" color="onHero">
                {copy.classes.invitePrompt}
              </AppText>
              <Button
                title={copy.classes.joinClass}
                variant="accent"
                onPress={() => router.push("/join")}
              />
            </View>
          )}
        </GradientHero>
      </View>

      {groupsQuery.isLoading ? (
        <ClassesSkeletonList />
      ) : (
        <FlatList
          ref={listRef}
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32 + miniPad,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={groupsQuery.isRefetching}
              onRefresh={() => void groupsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={GraduationCap}
              title={copy.classes.emptyTitle}
              subtitle={copy.classes.emptySubtitle}
              actionTitle={copy.classes.joinClass}
              onAction={() => router.push("/join")}
            />
          }
          renderItem={({ item, index }) => (
            <ClassRow item={item} index={index} reduceMotion={Boolean(reduceMotion)} />
          )}
        />
      )}
    </Screen>
  );
}

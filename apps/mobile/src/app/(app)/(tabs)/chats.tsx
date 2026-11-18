import type { ChatChannel, GroupSummary } from "@app/shared-types";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { router, useFocusEffect, type Href } from "expo-router";
import { ChevronRight, MessagesSquare } from "lucide-react-native";
import { useCallback, useMemo, useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppText } from "../../../components/AppText";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Screen } from "../../../components/Screen";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { ClassesSkeletonList } from "../../../components/Skeleton";
import { Button } from "../../../components/Button";
import { getApiClient } from "../../../lib/api";
import {
  channelLabel,
  channelPath,
  formatRelativeTime,
  lastMessagePreview,
  sortChannels,
} from "../../../lib/chat-logic";
import { copy } from "../../../lib/copy";
import { useTabScrollToTop } from "../../../lib/use-tab-scroll-to-top";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useTheme } from "../../../theme/theme";

type ChatRowModel = {
  key: string;
  group: GroupSummary;
  channel: ChatChannel;
};

function ChannelRow({
  row,
  index,
  reduceMotion,
}: {
  row: ChatRowModel;
  index: number;
  reduceMotion: boolean;
}) {
  const { colors } = useTheme();
  const preview = lastMessagePreview(row.channel.lastMessage);
  const time = row.channel.lastMessage ? formatRelativeTime(row.channel.lastMessage.createdAt) : "";
  const label = channelLabel(row.channel.kind);
  const content = (
    <Card
      pressable
      accessibilityLabel={`${row.group.name}, ${label}`}
      onPress={() =>
        router.push(
          channelPath({
            channelId: row.channel.id,
            groupId: row.group.id,
            kind: row.channel.kind,
            groupName: row.group.name,
          }) as Href,
        )
      }
      style={{ marginBottom: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
              {row.group.name}
            </AppText>
            {time ? (
              <AppText variant="caption" color="textMuted">
                {time}
              </AppText>
            ) : null}
          </View>
          <AppText variant="label" color="primary">
            {label}
          </AppText>
          <AppText variant="body" color="textMuted" numberOfLines={1}>
            {preview}
          </AppText>
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

export default function ChatsScreen() {
  const { colors } = useTheme();
  const miniPad = useMiniPlayerPadding();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatRowModel>>(null);
  const focusedOnce = useRef(false);
  useTabScrollToTop(listRef);

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => getApiClient().listGroups(),
  });
  const groups = useMemo(() => groupsQuery.data?.groups ?? [], [groupsQuery.data?.groups]);

  const chatQueries = useQueries({
    queries: groups.map((group) => ({
      queryKey: ["chats", group.id] as const,
      queryFn: () => getApiClient().listChats(group.id),
    })),
  });

  const rows = useMemo<ChatRowModel[]>(
    () =>
      groups.flatMap((group, index) =>
        sortChannels(chatQueries[index]?.data?.channels ?? []).map((channel) => ({
          key: channel.id,
          group,
          channel,
        })),
      ),
    [chatQueries, groups],
  );

  const chatsLoading = groups.length > 0 && chatQueries.some((query) => query.isLoading);
  const chatsFailed = chatQueries.some((query) => query.isError);
  const refreshing =
    groupsQuery.isRefetching || chatQueries.some((query) => query.isRefetching && !query.isLoading);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    }, [queryClient]),
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
      queryClient.invalidateQueries({ queryKey: ["chats"] }),
    ]);
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader title={copy.chats.title} />
      {groupsQuery.isLoading || (chatsLoading && rows.length === 0) ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ClassesSkeletonList />
        </View>
      ) : groupsQuery.isError ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <ErrorBanner message={copy.chats.loadFailed} />
          <Button
            title={copy.chats.retry}
            variant="outline"
            onPress={() => void groupsQuery.refetch()}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32 + miniPad,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            chatsFailed ? (
              <View style={{ marginBottom: 12 }}>
                <ErrorBanner message={copy.chats.loadFailed} />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={MessagesSquare}
              title={copy.chats.emptyTitle}
              subtitle={copy.chats.emptySubtitle}
            />
          }
          renderItem={({ item, index }) => (
            <ChannelRow row={item} index={index} reduceMotion={Boolean(reduceMotion)} />
          )}
        />
      )}
    </Screen>
  );
}

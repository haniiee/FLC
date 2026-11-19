import type { PlaylistSummary } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { ChevronRight, ListMusic } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppText } from "../../../components/AppText";
import { BookmarkSection } from "../../../components/content/BookmarkSection";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Screen } from "../../../components/Screen";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { ClassesSkeletonList } from "../../../components/Skeleton";
import { getApiClient } from "../../../lib/api";
import { copy } from "../../../lib/copy";
import { apiErrorMessage } from "../../../lib/format";
import {
  formatPlaylistSummary,
  playlistQueryKey,
  playlistsQueryKey,
} from "../../../lib/playlist-logic";
import { useTabScrollToTop } from "../../../lib/use-tab-scroll-to-top";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useTheme } from "../../../theme/theme";

function PlaylistRow({
  item,
  index,
  reduceMotion,
}: {
  item: PlaylistSummary;
  index: number;
  reduceMotion: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <Card
      pressable
      accessibilityLabel={item.displayName}
      onPress={() => router.push(`/playlists/${item.id}` as Href)}
      style={{ marginBottom: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="h3" numberOfLines={1}>
            {item.displayName}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {formatPlaylistSummary(item.itemCount, item.totalDurationMs)}
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

export default function LibraryScreen() {
  const { colors } = useTheme();
  const miniPad = useMiniPlayerPadding();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<PlaylistSummary>>(null);
  const focusedOnce = useRef(false);
  const [creating, setCreating] = useState(false);
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const [section, setSection] = useState<"playlists" | "bookmarks">(
    tabParam === "bookmarks" ? "bookmarks" : "playlists",
  );
  useTabScrollToTop(listRef);

  useEffect(() => {
    if (tabParam === "bookmarks") setSection("bookmarks");
  }, [tabParam]);

  const playlistsQuery = useQuery({
    queryKey: playlistsQueryKey,
    queryFn: () => getApiClient().playlists.list(),
  });
  const items = playlistsQuery.data?.items ?? [];

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      void queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
    }, [queryClient]),
  );

  async function onCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const created = await getApiClient().playlists.create();
      queryClient.setQueryData(playlistQueryKey(created.id), created);
      await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
      router.push(`/playlists/${created.id}` as Href);
    } catch (error) {
      Alert.alert(copy.library.createFailed, apiErrorMessage(error, copy.library.createFailed));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader title={copy.library.title} />
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {(
          [
            ["playlists", copy.library.playlists],
            ["bookmarks", copy.library.bookmarks],
          ] as const
        ).map(([id, label]) => {
          const selected = section === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSection(id)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? colors.primary : colors.primarySoft,
              }}
            >
              <AppText variant="label" color={selected ? "onPrimary" : "primary"}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {section === "bookmarks" ? (
        <BookmarkSection />
      ) : playlistsQuery.isLoading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ClassesSkeletonList />
        </View>
      ) : playlistsQuery.isError && items.length === 0 ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <ErrorBanner message={copy.library.loadFailed} />
          <Button
            title={copy.library.retry}
            variant="outline"
            onPress={() => void playlistsQuery.refetch()}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32 + miniPad,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={playlistsQuery.isRefetching && !playlistsQuery.isLoading}
              onRefresh={() => void playlistsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 12 }}>
              <AppText variant="h2">{copy.library.playlists}</AppText>
              <Button
                title={copy.library.newPlaylist}
                variant="secondary"
                loading={creating}
                disabled={creating}
                onPress={() => void onCreate()}
              />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={ListMusic}
              title={copy.library.emptyTitle}
              subtitle={copy.library.emptySubtitle}
            />
          }
          renderItem={({ item, index }) => (
            <PlaylistRow item={item} index={index} reduceMotion={Boolean(reduceMotion)} />
          )}
        />
      )}
    </Screen>
  );
}

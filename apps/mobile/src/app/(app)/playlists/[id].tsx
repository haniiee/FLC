import { ApiClientError } from "@app/api-client";
import type { PlaylistTrack } from "@app/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { ArrowLeft, ListMusic, Play } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Chip } from "../../../components/Chip";
import { ItemActionsSheet } from "../../../components/content/ItemActionsSheet";
import { RenameModal } from "../../../components/content/RenameModal";
import { EmptyState } from "../../../components/EmptyState";
import { MoreOptionsButton } from "../../../components/MoreOptionsButton";
import { Screen } from "../../../components/Screen";
import { LoadingScreen } from "../../../components/Skeleton";
import { getApiClient } from "../../../lib/api";
import { copy } from "../../../lib/copy";
import { apiErrorMessage } from "../../../lib/format";
import {
  buildPlaylistQueue,
  formatPlaylistClock,
  formatPlaylistSummary,
  moveDown,
  moveUp,
  playlistQueryKey,
  playlistTrackSubtitle,
  playlistsQueryKey,
} from "../../../lib/playlist-logic";
import { usePlayer } from "../../../player/context";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useTheme } from "../../../theme/theme";

export default function PlaylistDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { colors, isDark, spacing } = useTheme();
  const miniPad = useMiniPlayerPadding();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [menuFileId, setMenuFileId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const playlistQuery = useQuery({
    queryKey: playlistQueryKey(id ?? ""),
    queryFn: () => getApiClient().playlists.get(id!),
    enabled: Boolean(id),
  });

  const detail = playlistQuery.data;
  const orderedItems = useMemo(() => {
    const items = detail?.items ?? [];
    if (!editing) return items;
    const byId = new Map(items.map((item) => [item.fileId, item]));
    return draft.flatMap((fileId) => {
      const item = byId.get(fileId);
      return item ? [item] : [];
    });
  }, [detail?.items, draft, editing]);

  const reorder = useMutation({
    mutationFn: (fileIds: string[]) => getApiClient().playlists.reorder(id!, { fileIds }),
    onMutate: async (fileIds) => {
      await queryClient.cancelQueries({ queryKey: playlistQueryKey(id!) });
      const previous = queryClient.getQueryData<typeof detail>(playlistQueryKey(id!));
      if (previous) {
        const byId = new Map(previous.items.map((item) => [item.fileId, item]));
        queryClient.setQueryData(playlistQueryKey(id!), {
          ...previous,
          items: fileIds.flatMap((fileId) => {
            const item = byId.get(fileId);
            return item ? [item] : [];
          }),
        });
      }
      return { previous };
    },
    onError: (error, _fileIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(playlistQueryKey(id!), context.previous);
        setDraft(context.previous.items.map((item) => item.fileId));
      }
      Alert.alert(copy.library.reorderFailed, apiErrorMessage(error, copy.library.reorderFailed));
    },
    onSuccess: (next) => {
      queryClient.setQueryData(playlistQueryKey(id!), next);
      setEditing(false);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
      await queryClient.invalidateQueries({ queryKey: playlistQueryKey(id!) });
    },
  });

  async function playFrom(startFileId?: string) {
    if (!id || starting || editing) return;
    setStarting(true);
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: playlistQueryKey(id),
        queryFn: () => getApiClient().playlists.get(id),
        staleTime: 0,
      });
      const queue = buildPlaylistQueue(fresh.items, startFileId);
      if (startFileId && !queue.startFound) {
        Alert.alert(copy.library.voiceUnavailable);
        return;
      }
      if (queue.items.length === 0) {
        Alert.alert(copy.library.nothingToPlay);
        return;
      }
      await player.playQueue(queue.items, queue.startIndex);
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
    } finally {
      setStarting(false);
    }
  }

  async function onRemove(fileId: string) {
    if (!id) return;
    try {
      const next = await getApiClient().playlists.removeItem(id, fileId);
      queryClient.setQueryData(playlistQueryKey(id), next);
      await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
    }
  }

  if (!id || playlistQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (!detail) {
    const missing =
      playlistQuery.error instanceof ApiClientError &&
      (playlistQuery.error.status === 404 || playlistQuery.error.code === "PLAYLIST_NOT_FOUND");
    return (
      <Screen>
        <EmptyState
          icon={ListMusic}
          title={missing ? copy.library.playlistNotFound : copy.library.loadFailed}
          actionTitle={missing ? undefined : copy.library.retry}
          onAction={missing ? undefined : () => void playlistQuery.refetch()}
        />
      </Screen>
    );
  }

  const hasPlayable = orderedItems.some((item) => item.available && item.url);
  const menuItem = orderedItems.find((item) => item.fileId === menuFileId) ?? null;

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120 + miniPad,
          paddingHorizontal: spacing[4],
        }}
        refreshControl={
          <RefreshControl
            refreshing={playlistQuery.isRefetching && !editing}
            onRefresh={() => {
              if (!editing) void playlistQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={{
            paddingTop: spacing[2],
            paddingBottom: spacing[4],
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2] + 2,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.a11y.back}
            hitSlop={8}
            onPress={() => router.back()}
            style={{
              width: spacing[10],
              height: spacing[10],
              borderRadius: spacing[10] / 2,
              backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <AppText variant="h1" style={{ flex: 1 }} numberOfLines={2}>
            {detail.displayName}
          </AppText>
          <MoreOptionsButton onPress={() => setMenuOpen(true)} />
        </View>

        {editing ? (
          <Button
            title={copy.library.done}
            size="lg"
            loading={reorder.isPending}
            disabled={reorder.isPending}
            onPress={() => reorder.mutate(draft)}
          />
        ) : (
          <View style={{ gap: spacing[2] }}>
            <Button
              title={copy.library.playAll}
              size="lg"
              disabled={!hasPlayable || starting}
              loading={starting}
              leftIcon={
                starting ? undefined : (
                  <Play size={18} color={colors.onPrimary} fill={colors.onPrimary} />
                )
              }
              onPress={() => void playFrom()}
            />
            <AppText variant="body" color="textMuted" style={{ textAlign: "center" }}>
              {formatPlaylistSummary(detail.itemCount, detail.totalDurationMs)}
            </AppText>
            {detail.items.length > 1 ? (
              <Button
                title={copy.library.editOrder}
                variant="outline"
                onPress={() => {
                  setDraft(detail.items.map((item) => item.fileId));
                  setEditing(true);
                }}
              />
            ) : null}
          </View>
        )}

        <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
          {orderedItems.length === 0 ? (
            <EmptyState icon={ListMusic} title={copy.library.emptyVoices} />
          ) : (
            orderedItems.map((item, index) => (
              <TrackRow
                key={item.fileId}
                item={item}
                index={index}
                count={orderedItems.length}
                editing={editing}
                moving={reorder.isPending}
                onPlay={() => void playFrom(item.fileId)}
                onMore={() => setMenuFileId(item.fileId)}
                onMove={(direction) =>
                  setDraft((current) =>
                    direction === "up" ? moveUp(current, index) : moveDown(current, index),
                  )
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      <ItemActionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        deleteConfirmTitle={copy.library.deletePlaylistTitle}
        deleteConfirmMessage={copy.library.deletePlaylistMessage}
        onRename={() => setRenameOpen(true)}
        onDelete={async () => {
          try {
            await getApiClient().playlists.remove(id);
          } catch (error) {
            Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
            throw error;
          }
          await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
          await queryClient.invalidateQueries({ queryKey: playlistQueryKey(id) });
          router.replace("/library" as Href);
        }}
      />

      <ItemActionsSheet
        visible={menuItem != null}
        onClose={() => setMenuFileId(null)}
        extraActions={
          menuItem
            ? [
                {
                  title: copy.library.removeFromPlaylist,
                  onPress: () => void onRemove(menuItem.fileId),
                },
              ]
            : undefined
        }
      />

      <RenameModal
        visible={renameOpen}
        initialTitle={detail.title}
        onClose={() => setRenameOpen(false)}
        onSave={async (title) => {
          try {
            const next = await getApiClient().playlists.rename(id, { title });
            queryClient.setQueryData(playlistQueryKey(id), next);
            await queryClient.invalidateQueries({ queryKey: playlistsQueryKey });
          } catch (error) {
            Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
            throw error;
          }
        }}
      />
    </Screen>
  );
}

function TrackRow({
  item,
  index,
  count,
  editing,
  moving,
  onPlay,
  onMore,
  onMove,
}: {
  item: PlaylistTrack;
  index: number;
  count: number;
  editing: boolean;
  moving: boolean;
  onPlay: () => void;
  onMore: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const { spacing } = useTheme();
  const unavailable = !item.available;
  const duration = item.durationMs == null ? "" : formatPlaylistClock(item.durationMs);

  return (
    <Card padding={16} style={{ opacity: unavailable ? 0.45 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unavailable ? copy.library.unavailable : item.displayName}
          disabled={unavailable || editing}
          onPress={onPlay}
          style={{ flex: 1, gap: spacing[1] }}
        >
          <AppText variant="h3">{item.displayName}</AppText>
          <AppText variant="caption" color="textMuted">
            {playlistTrackSubtitle(item)}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {unavailable ? <Chip label={copy.library.unavailable} /> : null}
            {duration ? (
              <AppText variant="caption" color="textMuted">
                {duration}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        {editing ? (
          <View style={{ gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.library.moveUp}
              disabled={index === 0 || moving}
              hitSlop={6}
              onPress={() => onMove("up")}
            >
              <AppText variant="caption" color={index === 0 ? "textMuted" : "primary"}>
                {copy.library.moveUp}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.library.moveDown}
              disabled={index === count - 1 || moving}
              hitSlop={6}
              onPress={() => onMove("down")}
            >
              <AppText variant="caption" color={index === count - 1 ? "textMuted" : "primary"}>
                {copy.library.moveDown}
              </AppText>
            </Pressable>
          </View>
        ) : (
          <MoreOptionsButton onPress={onMore} />
        )}
      </View>
    </Card>
  );
}

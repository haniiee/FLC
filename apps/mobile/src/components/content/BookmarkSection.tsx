import type { Bookmark, FileKind } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import {
  Bookmark as BookmarkIcon,
  FileAudio2,
  FileImage,
  FileText,
  FileType,
  Film,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { getApiClient } from "../../lib/api";
import {
  bookmarksQueryKey,
  filterBookmarks,
  formatBookmarkAt,
  type BookmarkFilter,
} from "../../lib/bookmark-logic";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { usePlayer } from "../../player/context";
import { useMiniPlayerPadding } from "../../player/MiniPlayer";
import type { PlayerQueueItem } from "../../player/types";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Card } from "../Card";
import { Chip } from "../Chip";
import { EmptyState } from "../EmptyState";
import { ErrorBanner } from "../ErrorBanner";
import { MoreOptionsButton } from "../MoreOptionsButton";
import { Button } from "../Button";
import { ImageViewer } from "./ImageViewer";
import { ItemActionsSheet } from "./ItemActionsSheet";
import { RenameModal } from "./RenameModal";
import { TextViewer } from "./TextViewer";

const FILTERS: Array<{ id: BookmarkFilter; label: string }> = [
  { id: "all", label: copy.library.all },
  { id: "voices", label: copy.library.voices },
  { id: "files", label: copy.library.files },
];

function KindIcon({ kind }: { kind: FileKind }) {
  const { colors } = useTheme();
  const color = colors.primary;
  switch (kind) {
    case "audio":
      return <FileAudio2 size={22} color={color} />;
    case "pdf":
      return <FileType size={22} color={color} />;
    case "image":
      return <FileImage size={22} color={color} />;
    case "video":
      return <Film size={22} color={color} />;
    case "text":
      return <FileText size={22} color={color} />;
  }
}

function contextLine(item: Bookmark): string {
  const parts = [item.file.groupDisplayName, item.file.sessionDisplayName];
  if (item.file.topicDisplayName) parts.push(item.file.topicDisplayName);
  return parts.join(" · ");
}

export function BookmarkSection() {
  const { colors, spacing } = useTheme();
  const miniPad = useMiniPlayerPadding();
  const player = usePlayer();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BookmarkFilter>("all");
  const [menu, setMenu] = useState<Bookmark | null>(null);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [image, setImage] = useState<{ uri: string; title: string } | null>(null);
  const [text, setText] = useState<{ title: string; body: string } | null>(null);
  const [opening, setOpening] = useState(false);

  const bookmarksQuery = useQuery({
    queryKey: bookmarksQueryKey,
    queryFn: () => getApiClient().bookmarks.list(),
  });
  const items = filterBookmarks(bookmarksQuery.data?.items ?? [], filter);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
  }

  async function openText(item: Bookmark) {
    if (item.file.topicId) {
      const topic = await getApiClient().getTopic(item.file.topicId);
      return topic.files.find((file) => file.id === item.fileId)?.textContent ?? "";
    }
    const session = await getApiClient().getSession(item.file.sessionId);
    return session.files.find((file) => file.id === item.fileId)?.textContent ?? "";
  }

  async function openItem(item: Bookmark) {
    if (!item.available || !item.url || opening) return;
    setOpening(true);
    try {
      if (item.kind === "audio") {
        const queueItem: PlayerQueueItem = {
          fileId: item.fileId,
          displayName: item.file.displayName,
          durationMs: item.file.durationMs,
          url: item.url,
          sessionDisplayName: item.file.sessionDisplayName,
          groupDisplayName: item.file.groupDisplayName,
        };
        if (item.file.topicDisplayName) queueItem.topicDisplayName = item.file.topicDisplayName;
        await player.playQueue([queueItem], 0, item.positionMs ?? 0);
        return;
      }
      if (item.kind === "image") {
        setImage({ uri: item.url, title: item.file.displayName });
        return;
      }
      if (item.kind === "text") {
        setText({ title: item.file.displayName, body: await openText(item) });
        return;
      }
      await WebBrowser.openBrowserAsync(item.url);
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
    } finally {
      setOpening(false);
    }
  }

  if (bookmarksQuery.isLoading) {
    return null;
  }

  if (bookmarksQuery.isError && (bookmarksQuery.data?.items.length ?? 0) === 0) {
    return (
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <ErrorBanner message={copy.library.loadFailed} />
        <Button
          title={copy.library.retry}
          variant="outline"
          onPress={() => void bookmarksQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {FILTERS.map((option) => {
          const selected = filter === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option.id)}
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? colors.primary : colors.primarySoft,
              }}
            >
              <AppText variant="label" color={selected ? "onPrimary" : "primary"}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32 + miniPad,
          flexGrow: 1,
          gap: spacing[3],
        }}
        refreshControl={
          <RefreshControl
            refreshing={bookmarksQuery.isRefetching}
            onRefresh={() => void bookmarksQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={BookmarkIcon}
            title={filter === "all" ? copy.library.emptyBookmarks : copy.library.nothingInFilter}
            subtitle={filter === "all" ? copy.library.emptyBookmarksSubtitle : undefined}
          />
        ) : (
          items.map((item) => {
            const unavailable = !item.available;
            return (
              <Card key={item.id} padding={16} style={{ opacity: unavailable ? 0.45 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <KindIcon kind={item.kind} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.file.displayName}
                    disabled={unavailable}
                    onPress={() => void openItem(item)}
                    style={{ flex: 1, gap: 4 }}
                  >
                    <AppText variant="h3" numberOfLines={1}>
                      {item.file.displayName}
                    </AppText>
                    <AppText variant="caption" color="textMuted" numberOfLines={1}>
                      {contextLine(item)}
                    </AppText>
                    {item.kind === "audio" && item.positionMs != null ? (
                      <AppText variant="caption" color="primary">
                        {formatBookmarkAt(item.positionMs)}
                      </AppText>
                    ) : null}
                    {item.note ? (
                      <AppText variant="caption" color="textMuted" numberOfLines={2}>
                        {item.note}
                      </AppText>
                    ) : null}
                    {unavailable ? <Chip label={copy.library.unavailable} /> : null}
                  </Pressable>
                  <MoreOptionsButton onPress={() => setMenu(item)} />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <ItemActionsSheet
        visible={menu != null}
        onClose={() => setMenu(null)}
        extraActions={
          menu
            ? [
                {
                  title: copy.library.editNote,
                  onPress: () => setEditing(menu),
                },
                {
                  title: copy.library.removeBookmark,
                  destructive: true,
                  onPress: () => {
                    const id = menu.id;
                    void (async () => {
                      try {
                        await getApiClient().bookmarks.remove(id);
                        await refresh();
                      } catch (error) {
                        Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
                      }
                    })();
                  },
                },
              ]
            : undefined
        }
      />

      <RenameModal
        visible={editing != null}
        title={copy.library.editNote}
        label={copy.library.note}
        initialTitle={editing?.note ?? null}
        onClose={() => setEditing(null)}
        onSave={async (note) => {
          if (!editing) return;
          try {
            await getApiClient().bookmarks.update(editing.id, { note });
            await refresh();
          } catch (error) {
            Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
            throw error;
          }
        }}
      />

      <ImageViewer
        visible={image != null}
        uri={image?.uri ?? null}
        title={image?.title ?? ""}
        onClose={() => setImage(null)}
      />
      <TextViewer
        visible={text != null}
        title={text?.title ?? ""}
        textContent={text?.body}
        onClose={() => setText(null)}
      />
    </View>
  );
}

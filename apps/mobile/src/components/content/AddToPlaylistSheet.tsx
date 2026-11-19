import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiClient } from "../../lib/api";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { playlistQueryKey, playlistsQueryKey } from "../../lib/playlist-logic";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Button } from "../Button";

type AddToPlaylistSheetProps = {
  visible: boolean;
  fileIds: string[];
  onClose: () => void;
  onAdded?: (displayName: string) => void;
};

export function AddToPlaylistSheet({
  visible,
  fileIds,
  onClose,
  onAdded,
}: AddToPlaylistSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const listQuery = useQuery({
    queryKey: playlistsQueryKey,
    queryFn: () => getApiClient().playlists.list(),
    enabled: visible,
  });
  const summaries = listQuery.data?.items ?? [];
  const detailQueries = useQueries({
    queries: summaries.map((playlist) => ({
      queryKey: playlistQueryKey(playlist.id),
      queryFn: () => getApiClient().playlists.get(playlist.id),
      enabled: visible,
    })),
  });

  useEffect(() => {
    if (!visible) setToast(null);
  }, [visible]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
      onCloseRef.current();
    }, 1200);
    return () => clearTimeout(timer);
  }, [toast]);

  function finish(displayName: string) {
    onAdded?.(displayName);
    setToast(copy.library.addedTo(displayName));
  }

  async function invalidate(playlistId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: playlistsQueryKey }),
      queryClient.invalidateQueries({ queryKey: playlistQueryKey(playlistId) }),
    ]);
  }

  async function addToExisting(playlistId: string, displayName: string) {
    if (busyId || fileIds.length === 0) return;
    setBusyId(playlistId);
    try {
      await getApiClient().playlists.addItems(playlistId, { fileIds });
      await invalidate(playlistId);
      finish(displayName);
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function createAndAdd() {
    if (busyId || fileIds.length === 0) return;
    setBusyId("new");
    try {
      const created = await getApiClient().playlists.create({ fileIds });
      queryClient.setQueryData(playlistQueryKey(created.id), created);
      await invalidate(created.id);
      finish(created.displayName);
    } catch (error) {
      Alert.alert(copy.library.createFailed, apiErrorMessage(error, copy.library.createFailed));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.content.cancel}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 12,
            maxHeight: "80%",
          }}
        >
          <AppText variant="h2">{copy.library.addToPlaylist}</AppText>
          {toast ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.primarySoft,
              }}
            >
              <AppText variant="caption" color="primary">
                {toast}
              </AppText>
            </View>
          ) : null}
          {listQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : listQuery.isError ? (
            <View style={{ gap: 12 }}>
              <AppText variant="body" color="textMuted">
                {copy.library.loadFailed}
              </AppText>
              <Button
                title={copy.library.retry}
                variant="outline"
                onPress={() => void listQuery.refetch()}
              />
            </View>
          ) : (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.library.newPlaylist}
                disabled={busyId != null || toast != null}
                onPress={() => void createAndAdd()}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: colors.primarySoft,
                  opacity: busyId != null && busyId !== "new" ? 0.5 : 1,
                }}
              >
                {busyId === "new" ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Plus size={18} color={colors.primary} />
                )}
                <AppText variant="label" color="primary">
                  {copy.library.newPlaylist}
                </AppText>
              </Pressable>
              {summaries.map((playlist, index) => {
                const detail = detailQueries[index]?.data;
                const included = Boolean(
                  detail &&
                  fileIds.length > 0 &&
                  fileIds.every((fileId) => detail.items.some((item) => item.fileId === fileId)),
                );
                return (
                  <Pressable
                    key={playlist.id}
                    accessibilityRole="button"
                    accessibilityLabel={playlist.displayName}
                    accessibilityState={{ checked: included }}
                    disabled={busyId != null || toast != null}
                    onPress={() => void addToExisting(playlist.id, playlist.displayName)}
                    style={{
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[3],
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      opacity: busyId != null && busyId !== playlist.id ? 0.5 : 1,
                    }}
                  >
                    <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
                      {playlist.displayName}
                    </AppText>
                    {busyId === playlist.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : included ? (
                      <Check size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <Button title={copy.content.cancel} variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

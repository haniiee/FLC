import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, FileText } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { AppText } from "../../../components/AppText";
import { ContentActionsRow } from "../../../components/content/ContentActionsRow";
import { FileRow, OptimisticFileRow } from "../../../components/content/FileRow";
import { ItemActionsSheet } from "../../../components/content/ItemActionsSheet";
import { RenameModal } from "../../../components/content/RenameModal";
import { EmptyState } from "../../../components/EmptyState";
import { MoreOptionsButton } from "../../../components/MoreOptionsButton";
import { Screen } from "../../../components/Screen";
import { LoadingScreen } from "../../../components/Skeleton";
import { getApiClient } from "../../../lib/api";
import { canManageContent } from "../../../lib/content-permissions";
import { copy } from "../../../lib/copy";
import { filesRefetchInterval } from "../../../lib/files-refetch-interval";
import { apiErrorMessage } from "../../../lib/format";
import { pickAndUploadFile } from "../../../lib/pick-and-upload";
import { useVoiceUpload } from "../../../lib/use-voice-upload";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useTheme } from "../../../theme/theme";

export default function TopicDetailScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { colors, isDark, spacing } = useTheme();
  const miniPad = useMiniPlayerPadding();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ title: string; progress: number } | null>(
    null,
  );

  const topicQuery = useQuery({
    queryKey: ["topic", topicId],
    queryFn: () => getApiClient().getTopic(topicId),
    enabled: Boolean(topicId),
    refetchInterval: (query) => filesRefetchInterval(query.state.data?.files ?? []),
  });

  const sessionId = topicQuery.data?.topic.sessionId;
  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getApiClient().getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const groupId = sessionQuery.data?.session.groupId;
  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId!),
    enabled: Boolean(groupId),
  });

  const canManage = canManageContent(groupQuery.data?.myRole);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
    if (sessionId) {
      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    }
  }

  const voice = useVoiceUpload({
    sessionId,
    topicId,
    files: topicQuery.data?.files ?? [],
    onUploaded: refresh,
  });

  async function onAddFile() {
    if (!sessionId) return;
    try {
      setPendingUpload({ title: copy.content.uploading, progress: 0 });
      const file = await pickAndUploadFile({
        sessionId,
        topicId,
        onProgress: (progress) => setPendingUpload({ title: copy.content.uploading, progress }),
      });
      setPendingUpload(null);
      if (file) {
        await refresh();
      }
    } catch (error) {
      setPendingUpload(null);
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
    }
  }

  if (topicQuery.isLoading || sessionQuery.isLoading || groupQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (!topicQuery.data) {
    return (
      <Screen>
        <EmptyState icon={FileText} title={copy.content.topicNotFound} />
      </Screen>
    );
  }

  const { topic, files } = topicQuery.data;

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120 + miniPad,
          paddingHorizontal: spacing[4],
        }}
        refreshControl={
          <RefreshControl
            refreshing={topicQuery.isRefetching}
            onRefresh={() => void topicQuery.refetch()}
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
          <AppText variant="h1" style={{ flex: 1 }}>
            {topic.displayName}
          </AppText>
          {canManage ? <MoreOptionsButton onPress={() => setMenuOpen(true)} /> : null}
        </View>

        {canManage ? (
          <ContentActionsRow
            onAddFile={() => void onAddFile()}
            onVoiceCaptured={(capture) => void voice.upload(capture)}
            voiceDisabled={Boolean(pendingUpload) || voice.pending?.status === "uploading"}
          />
        ) : null}

        <AppText variant="h2" style={{ marginTop: spacing[6], marginBottom: spacing[3] }}>
          {copy.content.files}
        </AppText>
        {files.length === 0 && !pendingUpload && !voice.pending ? (
          <EmptyState icon={FileText} title={copy.content.emptyFiles} />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                canManage={canManage}
                onChanged={() => void refresh()}
                playContext={
                  sessionQuery.data && groupQuery.data
                    ? {
                        sessionId: sessionQuery.data.session.id,
                        sessionDisplayName: sessionQuery.data.session.displayName,
                        groupDisplayName: groupQuery.data.name,
                        topicDisplayName: topic.displayName,
                        containerFiles: files,
                      }
                    : undefined
                }
              />
            ))}
            {pendingUpload ? (
              <OptimisticFileRow title={pendingUpload.title} progress={pendingUpload.progress} />
            ) : null}
            {voice.pending ? (
              <OptimisticFileRow
                title={voice.pending.title}
                progress={voice.pending.progress}
                failed={voice.pending.status === "failed"}
                onRetry={voice.retry}
              />
            ) : null}
          </View>
        )}
      </ScrollView>

      <ItemActionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onRename={() => {
          setMenuOpen(false);
          setRenameOpen(true);
        }}
        onDelete={async () => {
          await getApiClient().deleteTopic(topic.id);
          if (sessionId) {
            await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
            router.replace(`/sessions/${sessionId}`);
          } else {
            router.back();
          }
        }}
      />

      <RenameModal
        visible={renameOpen}
        initialTitle={topic.title}
        onClose={() => setRenameOpen(false)}
        onSave={async (title) => {
          try {
            await getApiClient().updateTopic(topic.id, { title });
            await refresh();
          } catch (error) {
            Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
            throw error;
          }
        }}
      />
    </Screen>
  );
}

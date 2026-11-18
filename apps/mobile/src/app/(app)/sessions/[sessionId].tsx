import type { TopicSummary } from "@app/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookOpen, ChevronRight, FileText, Layers, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
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
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useTheme } from "../../../theme/theme";

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors, isDark, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const miniPad = useMiniPlayerPadding();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [topicMenu, setTopicMenu] = useState<TopicSummary | null>(null);
  const [renameTopic, setRenameTopic] = useState<TopicSummary | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ title: string; progress: number } | null>(
    null,
  );

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getApiClient().getSession(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => filesRefetchInterval(query.state.data?.files ?? []),
  });

  const groupId = sessionQuery.data?.session.groupId;
  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId!),
    enabled: Boolean(groupId),
  });

  const canManage = canManageContent(groupQuery.data?.myRole);

  const createTopic = useMutation({
    mutationFn: () => getApiClient().createTopic(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      if (groupId) {
        await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
      }
    },
    onError: (error) => Alert.alert(copy.content.actionFailed, apiErrorMessage(error)),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    if (groupId) {
      await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
    }
  }

  async function onAddFile() {
    try {
      setPendingUpload({ title: copy.content.uploading, progress: 0 });
      const file = await pickAndUploadFile({
        sessionId,
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

  if (sessionQuery.isLoading || groupQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (!sessionQuery.data) {
    return (
      <Screen>
        <EmptyState icon={BookOpen} title={copy.content.sessionNotFound} />
      </Screen>
    );
  }

  const { session, topics, files } = sessionQuery.data;
  const showTopNewTopic = canManage && topics.length > 0;

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120 + miniPad,
          paddingHorizontal: spacing[4],
        }}
        refreshControl={
          <RefreshControl
            refreshing={sessionQuery.isRefetching}
            onRefresh={() => void sessionQuery.refetch()}
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
            {session.displayName}
          </AppText>
          {canManage ? <MoreOptionsButton onPress={() => setMenuOpen(true)} /> : null}
        </View>

        {canManage ? (
          <View style={{ flexDirection: "row", gap: spacing[2] + 2 }}>
            {showTopNewTopic ? (
              <View style={{ flex: 1 }}>
                <Button
                  title={copy.content.newTopic}
                  variant="secondary"
                  leftIcon={<Plus size={18} color={colors.primary} />}
                  loading={createTopic.isPending}
                  onPress={() => createTopic.mutate()}
                />
              </View>
            ) : null}
            <View
              style={{ flex: showTopNewTopic ? 1 : undefined, alignSelf: "stretch", flexGrow: 1 }}
            >
              <Button
                title={copy.content.addFile}
                leftIcon={<Plus size={18} color={colors.onPrimary} />}
                onPress={() => void onAddFile()}
              />
            </View>
          </View>
        ) : null}

        <AppText variant="h2" style={{ marginTop: spacing[6], marginBottom: spacing[3] }}>
          {copy.content.topics}
        </AppText>
        {topics.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={canManage ? copy.content.emptyTopicsTeacher : copy.content.emptyTopics}
            actionTitle={canManage ? copy.content.newTopic : undefined}
            onAction={canManage ? () => createTopic.mutate() : undefined}
          />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {topics.map((topic) => (
              <Card key={topic.id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={topic.displayName}
                    onPress={() => router.push(`/topics/${topic.id}`)}
                    style={{ flex: 1, gap: spacing[1] }}
                  >
                    <AppText variant="h3">{topic.displayName}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {copy.group.filesCount(topic.fileCount)}
                    </AppText>
                  </Pressable>
                  {canManage ? <MoreOptionsButton onPress={() => setTopicMenu(topic)} /> : null}
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        )}

        <AppText variant="h2" style={{ marginTop: spacing[6], marginBottom: spacing[3] }}>
          {copy.content.sessionFiles}
        </AppText>
        {pendingUpload ? (
          <OptimisticFileRow title={pendingUpload.title} progress={pendingUpload.progress} />
        ) : null}
        {files.length === 0 && !pendingUpload ? (
          <EmptyState icon={FileText} title={copy.content.emptyFiles} />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                canManage={canManage}
                onChanged={() => void refresh()}
                playContext={{
                  sessionId: session.id,
                  sessionDisplayName: session.displayName,
                  groupDisplayName: groupQuery.data?.name ?? "",
                  containerFiles: files,
                }}
              />
            ))}
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
          await getApiClient().deleteSession(session.id);
          if (groupId) {
            await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
            router.replace(`/groups/${groupId}`);
          } else {
            router.back();
          }
        }}
      />

      <RenameModal
        visible={renameOpen}
        initialTitle={session.title}
        onClose={() => setRenameOpen(false)}
        onSave={async (title) => {
          try {
            await getApiClient().updateSession(session.id, { title });
            await refresh();
          } catch (error) {
            Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
            throw error;
          }
        }}
      />

      {topicMenu ? (
        <ItemActionsSheet
          visible={Boolean(topicMenu)}
          onClose={() => setTopicMenu(null)}
          onRename={() => {
            setRenameTopic(topicMenu);
            setTopicMenu(null);
          }}
          onDelete={async () => {
            await getApiClient().deleteTopic(topicMenu.id);
            setTopicMenu(null);
            await refresh();
          }}
        />
      ) : null}

      <RenameModal
        visible={Boolean(renameTopic)}
        initialTitle={renameTopic?.title ?? null}
        onClose={() => setRenameTopic(null)}
        onSave={async (title) => {
          if (!renameTopic) return;
          await getApiClient().updateTopic(renameTopic.id, { title });
          await refresh();
        }}
      />
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}

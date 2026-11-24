import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Chip, roleChipVariant } from "../../../components/Chip";
import { FileRow } from "../../../components/content/FileRow";
import { ItemActionsSheet } from "../../../components/content/ItemActionsSheet";
import { TextNoteModal } from "../../../components/content/TextNoteModal";
import { RenameModal } from "../../../components/content/RenameModal";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { GradientHero } from "../../../components/GradientHero";
import { MoreOptionsButton } from "../../../components/MoreOptionsButton";
import { Screen } from "../../../components/Screen";
import { SessionsSkeletonList } from "../../../components/Skeleton";
import { getApiClient } from "../../../lib/api";
import {
  channelLabel,
  channelPath,
  lastMessagePreview,
  sortChannels,
} from "../../../lib/chat-logic";
import { canManageContent } from "../../../lib/content-permissions";
import { copy } from "../../../lib/copy";
import { apiErrorMessage, roleLabel } from "../../../lib/format";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useTheme } from "../../../theme/theme";

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const miniPad = useMiniPlayerPadding();
  const queryClient = useQueryClient();
  const [actionsSessionId, setActionsSessionId] = useState<string | null>(null);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId),
    enabled: Boolean(groupId),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions", groupId],
    queryFn: () => getApiClient().listSessions(groupId),
    enabled: Boolean(groupId),
  });

  const filesQuery = useQuery({
    queryKey: ["group-files", groupId],
    queryFn: () => getApiClient().listGroupFiles(groupId),
    enabled: Boolean(groupId),
  });

  const chatsQuery = useQuery({
    queryKey: ["chats", groupId],
    queryFn: () => getApiClient().listChats(groupId),
    enabled: Boolean(groupId),
  });
  const channels = sortChannels(chatsQuery.data?.channels ?? []);

  const createSession = useMutation({
    mutationFn: () => getApiClient().createSession(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
    },
    onError: (error) => {
      Alert.alert(copy.group.loadFailed, apiErrorMessage(error, copy.group.loadFailed));
    },
  });

  const canManage = canManageContent(groupQuery.data?.myRole);
  const sessions = sessionsQuery.data?.sessions ?? [];
  const actionSession = sessions.find((s) => s.id === actionsSessionId);
  const renameSession = sessions.find((s) => s.id === renameSessionId);

  async function refreshSessions() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sessions", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["chats", groupId] }),
      queryClient.invalidateQueries({ queryKey: ["group-files", groupId] }),
    ]);
  }

  if (groupQuery.isLoading) {
    return (
      <Screen padded={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <SessionsSkeletonList />
        </View>
      </Screen>
    );
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
      <ScrollView
        contentContainerStyle={{ paddingBottom: (canManage ? 120 : 96) + miniPad }}
        refreshControl={
          <RefreshControl
            refreshing={
              (sessionsQuery.isRefetching && !sessionsQuery.isLoading) ||
              (chatsQuery.isRefetching && !chatsQuery.isLoading)
            }
            onRefresh={() => void refreshSessions()}
            tintColor={colors.primary}
          />
        }
      >
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

        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[5], gap: spacing[3] }}>
          {chatsQuery.isError ? (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h2">{copy.group.chat}</AppText>
              <ErrorBanner message={copy.group.chatLoadFailed} />
              <Button
                title={copy.group.retry}
                onPress={() => void chatsQuery.refetch()}
                variant="outline"
              />
            </View>
          ) : channels.length > 0 ? (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h2">{copy.group.chat}</AppText>
              {channels.map((channel) => (
                <Card
                  key={channel.id}
                  pressable
                  accessibilityLabel={`${copy.group.chat}, ${channelLabel(channel.kind)}`}
                  onPress={() =>
                    router.push(
                      channelPath({
                        channelId: channel.id,
                        groupId: group.id,
                        kind: channel.kind,
                        groupName: group.name,
                      }) as Href,
                    )
                  }
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="h3">{channelLabel(channel.kind)}</AppText>
                      <AppText variant="caption" color="textMuted" numberOfLines={1}>
                        {lastMessagePreview(channel.lastMessage)}
                      </AppText>
                    </View>
                    <ChevronRight size={20} color={colors.textMuted} />
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          {(canManage || (filesQuery.data?.files.length ?? 0) > 0) && (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h2">{copy.content.classNotes}</AppText>
              {canManage ? (
                <Button
                  title={copy.content.sendText}
                  variant="outline"
                  onPress={() => setTextOpen(true)}
                />
              ) : null}
              {(filesQuery.data?.files ?? []).map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  onChanged={() => void filesQuery.refetch()}
                />
              ))}
            </View>
          )}

          <AppText variant="h2">{copy.group.sessions}</AppText>

          {sessionsQuery.isError ? (
            <View style={{ gap: spacing[3] }}>
              <ErrorBanner message={copy.group.loadFailed} />
              <Button
                title={copy.group.retry}
                onPress={() => void sessionsQuery.refetch()}
                variant="outline"
              />
            </View>
          ) : sessionsQuery.isLoading ? (
            <SessionsSkeletonList />
          ) : sessions.length === 0 ? (
            <View
              style={{
                minHeight: 240,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <EmptyState
                icon={BookOpen}
                title={
                  canManage ? copy.group.emptySessionsTeacher : copy.group.emptySessionsStudent
                }
                subtitle={copy.group.emptySessionsSubtitle}
                actionTitle={canManage ? copy.group.newSession : undefined}
                onAction={canManage ? () => createSession.mutate() : undefined}
              />
            </View>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  pressable
                  accessibilityLabel={session.displayName}
                  onPress={() => router.push(`/sessions/${session.id}`)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <AppText variant="h3">{session.displayName}</AppText>
                      <AppText variant="caption" color="textMuted">
                        {copy.group.sessionMeta(session.topicCount, session.fileCount)}
                      </AppText>
                    </View>
                    {canManage ? (
                      <MoreOptionsButton
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setActionsSessionId(session.id);
                        }}
                      />
                    ) : null}
                    <ChevronRight size={20} color={colors.textMuted} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {canManage && sessions.length > 0 ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 16),
          }}
        >
          <Button
            title={copy.group.newSession}
            loading={createSession.isPending}
            disabled={createSession.isPending}
            onPress={() => createSession.mutate()}
          />
        </View>
      ) : null}

      {actionSession ? (
        <ItemActionsSheet
          visible={Boolean(actionsSessionId)}
          onClose={() => setActionsSessionId(null)}
          onRename={() => {
            setRenameSessionId(actionSession.id);
            setActionsSessionId(null);
          }}
          onDelete={async () => {
            await getApiClient().deleteSession(actionSession.id);
            setActionsSessionId(null);
            await refreshSessions();
          }}
        />
      ) : null}

      <TextNoteModal
        visible={textOpen}
        onClose={() => setTextOpen(false)}
        onSubmit={async (content) => {
          try {
            await getApiClient().createTextFile({ groupId, content });
            Alert.alert(copy.content.textAdded);
            await filesQuery.refetch();
          } catch (error) {
            Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
            throw error;
          }
        }}
      />

      <RenameModal
        visible={Boolean(renameSession)}
        initialTitle={renameSession?.title ?? null}
        onClose={() => setRenameSessionId(null)}
        onSave={async (title) => {
          if (!renameSession) return;
          await getApiClient().updateSession(renameSession.id, { title });
          await refreshSessions();
        }}
      />
    </Screen>
  );
}

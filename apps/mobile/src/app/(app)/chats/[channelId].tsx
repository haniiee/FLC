import { ApiClientError } from "@app/api-client";
import type { ChatChannelKind } from "@app/shared-types";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, MessagesSquare } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../components/AppText";
import { ChatComposer } from "../../../components/chat/ChatComposer";
import { ChatVoiceProvider } from "../../../components/chat/ChatVoiceProvider";
import { ConnectionBanner } from "../../../components/chat/ConnectionBanner";
import { MessageActionsSheet } from "../../../components/chat/MessageActionsSheet";
import { MessageBubble } from "../../../components/chat/MessageBubble";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Screen } from "../../../components/Screen";
import { getApiClient } from "../../../lib/api";
import {
  CHAT_PAGE_SIZE,
  applyDelete,
  applyOptimistic,
  buildChatRows,
  canDeleteMessage,
  channelLabel,
  chatMessagesQueryKey,
  createClientId,
  createOptimisticText,
  flattenMessages,
  markOptimisticFailed,
  mergeLatestPage,
  nextMessageCursor,
  pageHasMore,
  parseChannelKind,
  removeMessage,
  replaceOptimistic,
  type ChatInfiniteData,
  type ChatRow,
  type ClientChatMessage,
} from "../../../lib/chat-logic";
import {
  beginVoiceRetry,
  bindVoiceUploadId,
  createOptimisticVoice,
  failVoiceUpload,
} from "../../../lib/chat-voice";
import { copy } from "../../../lib/copy";
import { putLocalFile, readLocalFileSize } from "../../../lib/upload-local-file";
import { deleteLocalCapture, type VoiceCapture } from "../../../lib/upload-voice";
import { useMiniPlayerPadding } from "../../../player/MiniPlayer";
import { useAuth } from "../../../providers/auth-provider";
import { useChannel } from "../../../realtime/use-channel";
import { useTheme } from "../../../theme/theme";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ChannelScreen() {
  const params = useLocalSearchParams<{
    channelId: string;
    groupId?: string;
    kind?: string;
    groupName?: string;
  }>();
  const channelId = firstParam(params.channelId);
  const groupId = firstParam(params.groupId);
  const kind: ChatChannelKind | null = parseChannelKind(firstParam(params.kind) || undefined);
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const miniPad = useMiniPlayerPadding();
  const queryClient = useQueryClient();
  const { connected } = useChannel(channelId || undefined);
  const listRef = useRef<FlatList<ChatRow>>(null);
  const awayFromLatest = useRef(false);
  const canPaginate = useRef(false);
  const seenNewest = useRef<string | null>(null);
  const draftRef = useRef("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<ClientChatMessage | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId),
    enabled: Boolean(groupId),
  });
  const groupName = firstParam(params.groupName) || groupQuery.data?.name || "";
  const myRole = groupQuery.data?.myRole;

  const messagesQuery = useInfiniteQuery({
    queryKey: chatMessagesQueryKey(channelId || "missing"),
    enabled: Boolean(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const fetched = await getApiClient().listChatMessages(channelId, {
        before: pageParam,
        limit: CHAT_PAGE_SIZE,
      });
      const hasMore = pageHasMore(fetched.messages.length);
      if (pageParam) return { messages: fetched.messages, hasMore };
      const current = queryClient.getQueryData<ChatInfiniteData>(chatMessagesQueryKey(channelId));
      return { messages: mergeLatestPage(fetched.messages, current), hasMore };
    },
    getNextPageParam: (lastPage) => nextMessageCursor(lastPage),
  });

  const flat = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);
  const rows = useMemo(() => buildChatRows(flat, { myUserId: user?.id ?? "" }), [flat, user?.id]);
  const newest = flat[0];

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!newest) return;
    if (newest.id === seenNewest.current) return;
    const hadPrevious = seenNewest.current != null;
    seenNewest.current = newest.id;
    if (!hadPrevious || newest.sender.id === user?.id || !awayFromLatest.current) {
      listRef.current?.scrollToOffset({ offset: 0, animated: hadPrevious });
      setHasNew(false);
      return;
    }
    setHasNew(true);
  }, [newest, user?.id]);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function onChangeDraft(value: string) {
    draftRef.current = value;
    setDraft(value);
  }

  async function deliver(text: string) {
    if (!channelId || !user) return;
    const clientId = createClientId();
    const optimistic = createOptimisticText({
      clientId,
      channelId,
      text,
      sender: {
        id: user.id,
        displayName: user.displayName,
        role: myRole ?? "student",
      },
    });
    const key = chatMessagesQueryKey(channelId);
    queryClient.setQueryData<ChatInfiniteData>(key, (prev) => applyOptimistic(prev, optimistic));
    try {
      const saved = await getApiClient().sendChatText(channelId, { text });
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
        replaceOptimistic(prev, clientId, saved),
      );
      if (groupId) void queryClient.invalidateQueries({ queryKey: ["chats", groupId] });
    } catch {
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
        markOptimisticFailed(prev, clientId),
      );
    }
  }

  function onSend() {
    const text = draftRef.current.trim();
    if (!text || !channelId || !user) return;
    draftRef.current = "";
    setDraft("");
    void deliver(text);
  }

  async function deliverVoice(capture: VoiceCapture, existingTempId?: string) {
    if (!channelId || !user) return;
    const key = chatMessagesQueryKey(channelId);
    const clientId = existingTempId ?? createClientId();
    if (existingTempId) {
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
        beginVoiceRetry(prev, existingTempId),
      );
    } else {
      const optimistic = createOptimisticVoice({
        clientId,
        channelId,
        durationMs: capture.durationMs,
        mimeType: capture.mimeType,
        localUri: capture.uri,
        sender: {
          id: user.id,
          displayName: user.displayName,
          role: myRole ?? "student",
        },
      });
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) => applyOptimistic(prev, optimistic));
    }

    let orphanMessageId: string | undefined;
    try {
      const sizeBytes = await readLocalFileSize(capture.uri, capture.fileName);
      const prepared = await getApiClient().createChatVoiceUploadUrl(channelId, {
        mimeType: capture.mimeType,
        sizeBytes,
      });
      orphanMessageId = prepared.message.id;
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
        bindVoiceUploadId(prev, clientId, prepared.message.id),
      );
      await putLocalFile(prepared.uploadUrl, capture.uri, capture.mimeType);
      const saved = await getApiClient().completeChatVoice(prepared.message.id);
      orphanMessageId = undefined;
      const withDuration =
        saved.durationMs != null && saved.durationMs > 0
          ? saved
          : { ...saved, durationMs: capture.durationMs };
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
        replaceOptimistic(prev, clientId, withDuration),
      );
      try {
        await deleteLocalCapture(capture.uri);
      } catch {
        // The message is already on the server.
      }
      if (groupId) void queryClient.invalidateQueries({ queryKey: ["chats", groupId] });
    } catch {
      const failed = failVoiceUpload(queryClient.getQueryData<ChatInfiniteData>(key), clientId);
      queryClient.setQueryData<ChatInfiniteData>(key, failed.data);
      const orphan = failed.orphanMessageId ?? orphanMessageId;
      if (orphan) {
        try {
          await getApiClient().deleteChatMessage(orphan);
        } catch {
          // The local row can still be retried from the recording.
        }
      }
    }
  }

  function onRetry(message: ClientChatMessage) {
    if (message.type === "voice") {
      if (!message.localUri || !channelId) return;
      void deliverVoice(
        {
          uri: message.localUri,
          durationMs: message.durationMs ?? 0,
          mimeType: message.localMimeType ?? message.mimeType ?? "audio/mp4",
          fileName: "recording.m4a",
        },
        message.tempId ?? message.id,
      );
      return;
    }
    const text = message.text?.trim();
    if (!text || !channelId) return;
    queryClient.setQueryData<ChatInfiniteData>(chatMessagesQueryKey(channelId), (prev) =>
      removeMessage(prev, message.tempId ?? message.id),
    );
    void deliver(text);
  }

  async function onDelete(message: ClientChatMessage) {
    if (!channelId) return;
    const key = chatMessagesQueryKey(channelId);
    if (message.tempId || message.sendFailed) {
      queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
        removeMessage(prev, message.tempId ?? message.id),
      );
      return;
    }
    queryClient.setQueryData<ChatInfiniteData>(key, (prev) =>
      applyDelete(prev, { id: message.id }),
    );
    try {
      await getApiClient().deleteChatMessage(message.id);
    } catch (error) {
      void queryClient.invalidateQueries({ queryKey: key });
      showToast(
        error instanceof ApiClientError && error.status === 403
          ? copy.chats.deleteForbidden
          : copy.chats.deleteFailed,
      );
    }
  }

  async function onCopy(text: string) {
    try {
      const clipboard = await import("expo-clipboard");
      await clipboard.setStringAsync(text);
      showToast(copy.chats.copied);
    } catch {
      showToast(copy.chats.copyFailed);
    }
  }

  function openMenu(message: ClientChatMessage) {
    if (message.deleted) return;
    const copyable = message.type === "text" && Boolean(message.text);
    const deletable = canDeleteMessage({
      myUserId: user?.id ?? "",
      myRole,
      senderId: message.sender.id,
    });
    if (!copyable && !deletable) return;
    setMenu(message);
  }

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const away = event.nativeEvent.contentOffset.y > 80;
    awayFromLatest.current = away;
    if (away) canPaginate.current = true;
    if (!away) setHasNew((current) => (current ? false : current));
  }, []);

  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;
  const userId = user?.id;

  const keyExtractor = useCallback((row: ChatRow) => row.key, []);

  const onEndReached = useCallback(() => {
    if (!canPaginate.current) return;
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      void messagesQuery.fetchNextPage();
    }
  }, [messagesQuery.hasNextPage, messagesQuery.isFetchingNextPage, messagesQuery.fetchNextPage]);

  const maintainPosition = useMemo(
    () => ({ minIndexForVisible: 1, autoscrollToTopThreshold: 48 }),
    [],
  );

  const listFooter = useMemo(
    () =>
      messagesQuery.isFetchingNextPage ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : undefined,
    [colors.primary, messagesQuery.isFetchingNextPage],
  );

  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item }) => {
      if (item.type === "day") {
        return (
          <View style={{ alignItems: "center", marginTop: 16, marginBottom: 4 }}>
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <AppText variant="caption" color="textMuted">
                {item.label}
              </AppText>
            </View>
          </View>
        );
      }
      return (
        <MessageBubble
          message={item.message}
          mine={item.message.sender.id === userId}
          showSender={item.showSender}
          showTime={item.showTime}
          grouped={item.grouped}
          onLongPress={() => openMenuRef.current(item.message)}
          onRetry={() => onRetryRef.current(item.message)}
        />
      );
    },
    [colors.surfaceMuted, userId],
  );

  const menuCanCopy = Boolean(menu && menu.type === "text" && menu.text);
  const menuCanDelete = Boolean(
    menu &&
    canDeleteMessage({
      myUserId: user?.id ?? "",
      myRole,
      senderId: menu.sender.id,
    }),
  );
  const bottomInset = keyboardOpen ? 8 : Math.max(insets.bottom, 10) + miniPad;

  return (
    <ChatVoiceProvider>
      <Screen padded={false} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingRight: 16,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.a11y.back}
              onPress={() => router.back()}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <ArrowLeft size={22} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="h3" numberOfLines={1}>
                {kind ? channelLabel(kind) : copy.chats.title}
              </AppText>
              {groupName ? (
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {groupName}
                </AppText>
              ) : null}
            </View>
          </View>

          <ConnectionBanner connected={connected} />

          {messagesQuery.isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : messagesQuery.isError && flat.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", padding: 16, gap: 12 }}>
              <ErrorBanner message={copy.chats.loadMessagesFailed} />
              <Button
                title={copy.chats.retry}
                variant="outline"
                onPress={() => void messagesQuery.refetch()}
              />
            </View>
          ) : flat.length === 0 ? (
            <View style={{ flex: 1 }}>
              <EmptyState
                icon={MessagesSquare}
                title={copy.chats.threadEmptyTitle}
                subtitle={copy.chats.threadEmptySubtitle}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                ref={listRef}
                data={rows}
                extraData={userId}
                inverted
                keyExtractor={keyExtractor}
                keyboardShouldPersistTaps="handled"
                onScroll={onScroll}
                scrollEventThrottle={16}
                onEndReachedThreshold={0.4}
                onEndReached={onEndReached}
                maintainVisibleContentPosition={maintainPosition}
                ListFooterComponent={listFooter}
                renderItem={renderItem}
              />
              {hasNew ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.chats.newMessages}
                  onPress={() => {
                    awayFromLatest.current = false;
                    setHasNew(false);
                    listRef.current?.scrollToOffset({ offset: 0, animated: true });
                  }}
                  style={{
                    position: "absolute",
                    alignSelf: "center",
                    bottom: 12,
                    backgroundColor: colors.primary,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <AppText variant="caption" color="onPrimary">
                    {copy.chats.newMessages}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          )}

          {toast ? (
            <View style={{ alignItems: "center", paddingBottom: 6 }}>
              <View
                accessibilityLiveRegion="polite"
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <AppText variant="caption">{toast}</AppText>
              </View>
            </View>
          ) : null}

          <ChatComposer
            value={draft}
            onChangeText={onChangeDraft}
            onSend={onSend}
            onVoice={(capture) => void deliverVoice(capture)}
            bottomInset={bottomInset}
          />
        </KeyboardAvoidingView>

        <MessageActionsSheet
          visible={menu != null}
          canCopy={menuCanCopy}
          canDelete={menuCanDelete}
          onClose={() => setMenu(null)}
          onCopy={() => {
            if (menu?.text) void onCopy(menu.text);
          }}
          onDelete={async () => {
            if (menu) await onDelete(menu);
          }}
        />
      </Screen>
    </ChatVoiceProvider>
  );
}

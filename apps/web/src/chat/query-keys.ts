export function chatChannelsQueryKey(groupId: string) {
  return ["chats", groupId] as const;
}

export function chatMessagesQueryKey(channelId: string) {
  return ["chat-messages", channelId] as const;
}

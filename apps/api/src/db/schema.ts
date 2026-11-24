import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const platformRoleEnum = pgEnum("platform_role", ["teacher", "user", "admin"]);
export const groupRoleEnum = pgEnum("group_role", ["teacher", "assistant", "student"]);
export const fileKindEnum = pgEnum("file_kind", ["audio", "pdf", "image", "video", "text"]);
export const fileStatusEnum = pgEnum("file_status", ["pending", "processing", "ready", "failed"]);
export const fileSourceEnum = pgEnum("file_source", ["upload", "recording"]);
export const chatChannelKindEnum = pgEnum("chat_channel_kind", ["all", "students"]);
export const chatMessageTypeEnum = pgEnum("chat_message_type", ["text", "voice"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  platformRole: platformRoleEnum("platform_role").notNull().default("user"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdBy: uuid("created_by").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

export const groupInvites = pgTable("group_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("sessions_group_number_uq").on(table.groupId, table.number)],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("topics_session_number_uq").on(table.sessionId, table.number)],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    kind: fileKindEnum("kind").notNull(),
    number: integer("number"),
    title: text("title"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    durationMs: integer("duration_ms"),
    textContent: text("text_content"),
    status: fileStatusEnum("status").notNull().default("pending"),
    processingError: text("processing_error"),
    source: fileSourceEnum("source").notNull().default("upload"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("files_session_direct_kind_number_uq")
      .on(table.sessionId, table.kind, table.number)
      .where(sql`${table.topicId} is null`),
    uniqueIndex("files_topic_kind_number_uq")
      .on(table.topicId, table.kind, table.number)
      .where(sql`${table.topicId} is not null`),
  ],
);

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("playlists_owner_number_uq").on(table.ownerId, table.number)],
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("playlist_items_playlist_file_uq").on(table.playlistId, table.fileId),
    index("playlist_items_playlist_position_idx").on(table.playlistId, table.position),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    positionMs: integer("position_ms"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bookmarks_user_file_plain_uq")
      .on(table.userId, table.fileId)
      .where(sql`${table.positionMs} is null`),
    uniqueIndex("bookmarks_user_file_position_uq")
      .on(table.userId, table.fileId, table.positionMs)
      .where(sql`${table.positionMs} is not null`),
    index("bookmarks_user_created_idx").on(table.userId, table.createdAt.desc()),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  ownedGroups: many(groups),
  memberships: many(groupMembers),
  refreshTokens: many(refreshTokens),
  playlists: many(playlists),
  bookmarks: many(bookmarks),
  creator: one(users, {
    fields: [users.createdBy],
    references: [users.id],
    relationName: "user_creator",
  }),
  createdUsers: many(users, { relationName: "user_creator" }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, {
    fields: [groups.ownerId],
    references: [users.id],
  }),
  members: many(groupMembers),
  invites: many(groupInvites),
  sessions: many(sessions),
  files: many(files),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const groupInvitesRelations = relations(groupInvites, ({ one }) => ({
  group: one(groups, {
    fields: [groupInvites.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [groupInvites.createdBy],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  group: one(groups, {
    fields: [sessions.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [sessions.createdBy],
    references: [users.id],
  }),
  topics: many(topics),
  files: many(files),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  session: one(sessions, {
    fields: [topics.sessionId],
    references: [sessions.id],
  }),
  creator: one(users, {
    fields: [topics.createdBy],
    references: [users.id],
  }),
  files: many(files),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  owner: one(users, {
    fields: [playlists.ownerId],
    references: [users.id],
  }),
  items: many(playlistItems),
}));

export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistItems.playlistId],
    references: [playlists.id],
  }),
  file: one(files, {
    fields: [playlistItems.fileId],
    references: [files.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  file: one(files, {
    fields: [bookmarks.fileId],
    references: [files.id],
  }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  group: one(groups, {
    fields: [files.groupId],
    references: [groups.id],
  }),
  session: one(sessions, {
    fields: [files.sessionId],
    references: [sessions.id],
  }),
  topic: one(topics, {
    fields: [files.topicId],
    references: [topics.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
  bookmarks: many(bookmarks),
}));

export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    kind: chatChannelKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("chat_channels_group_kind_uq").on(table.groupId, table.kind)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    type: chatMessageTypeEnum("type").notNull(),
    text: text("text"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    durationMs: integer("duration_ms"),
    status: fileStatusEnum("status").notNull().default("pending"),
    processingError: text("processing_error"),
    replyToId: uuid("reply_to_id").references((): AnyPgColumn => chatMessages.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("chat_messages_channel_created_id_idx").on(
      table.channelId,
      sql`${table.createdAt} DESC`,
      table.id,
    ),
  ],
);

export const chatChannelsRelations = relations(chatChannels, ({ one, many }) => ({
  group: one(groups, {
    fields: [chatChannels.groupId],
    references: [groups.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  channel: one(chatChannels, {
    fields: [chatMessages.channelId],
    references: [chatChannels.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
  replyTo: one(chatMessages, {
    fields: [chatMessages.replyToId],
    references: [chatMessages.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type GroupInvite = typeof groupInvites.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type ChatChannelRow = typeof chatChannels.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;

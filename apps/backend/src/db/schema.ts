import { pgTable, text, integer, boolean, timestamp, primaryKey, index, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  status: text("status").default("offline"),
  role: text("role").notNull().default("user"),
  noiseSuppression: boolean("noise_suppression").default(false),
  micGain: integer("mic_gain").default(100),
  outputVolume: integer("output_volume").default(100),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const communities = pgTable("communities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  ownerId: text("owner_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const members = pgTable("members", {
  userId: text("user_id").references(() => users.id),
  communityId: text("community_id").references(() => communities.id),
  role: text("role").notNull().default("member"),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.communityId] }),
}));

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  communityId: text("community_id").references(() => communities.id),
  order: integer("order").notNull().default(0),
});

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"), // 'text' or 'voice'
  communityId: text("community_id").references(() => communities.id),
  categoryId: text("category_id").references(() => categories.id),
  order: integer("order").notNull().default(0),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  authorId: text("author_id").notNull().references(() => users.id),
  channelId: text("channel_id").references(() => channels.id),
  parentId: text("parent_id"), // For replies
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" }),
  isDeleted: boolean("is_deleted").default(false),
  type: text("type").notNull().default("text"), // 'text', 'call_missed', etc.
  linkMetadata: text("link_metadata"), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
}, (t) => ({
  createdIdx: index("msg_created_idx").on(t.createdAt),
  channelIdx: index("msg_channel_idx").on(t.channelId),
}));

export const reactions = pgTable("reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id),
  userId: text("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
}, (t) => ({
  uniqueReaction: uniqueIndex("unique_reaction_idx").on(t.messageId, t.userId, t.emoji),
}));

export const calls = pgTable("calls", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("channel"), // 'channel' or 'direct'
  status: text("status").notNull().default("active"), // 'active', 'ended', 'missed', 'rejected'
  channelId: text("channel_id").references(() => channels.id),
  callerId: text("caller_id").references(() => users.id), // For direct calls
  calleeId: text("callee_id").references(() => users.id), // For direct calls
  isActive: boolean("is_active").default(true),
  mos: text("mos"), // Mean Opinion Score (avg at end of call)
  avgBitrate: integer("avg_bitrate"),
  packetLoss: text("packet_loss"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
});

export const callParticipants = pgTable("call_participants", {
  callId: text("call_id").references(() => calls.id),
  userId: text("user_id").references(() => users.id),
  joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true, mode: "date" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.callId, t.userId] }),
}));

export const dmConversations = pgTable("dm_conversations", {
  id: text("id").primaryKey(),
  user1Id: text("user1_id").notNull().references(() => users.id),
  user2Id: text("user2_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
}, (t) => ({
  uniqueConv: uniqueIndex("dm_unique_conv_idx").on(t.user1Id, t.user2Id),
}));

export const directMessages = pgTable("direct_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => dmConversations.id),
  authorId: text("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  isRead: boolean("is_read").default(false),
  isDelivered: boolean("is_delivered").default(false),
  type: text("type").notNull().default("text"), // 'text', 'call_missed', etc.
  callId: text("call_id").references(() => calls.id),
  linkMetadata: text("link_metadata"), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
}, (t) => ({
  createdIdx: index("dm_created_idx").on(t.createdAt),
  convIdx: index("dm_conv_idx").on(t.conversationId),
}));

export const serverSettings = pgTable("server_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const callLogs = pgTable("call_logs", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").references(() => dmConversations.id),
  callerId: text("caller_id").notNull().references(() => users.id),
  calleeId: text("callee_id").notNull().references(() => users.id),
  status: text("status").notNull(), // 'accepted', 'ended', 'missed', 'rejected', 'timeout', 'error'
  duration: integer("duration"), // in seconds
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  adminId: text("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  target: text("target"), // the thing affected (e.g. user email)
  details: text("details"), // JSON string
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  admin: one(users, { fields: [auditLogs.adminId], references: [users.id] }),
}));

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  reactions: many(reactions),
  dmConversations1: many(dmConversations, { relationName: "user1" }),
  dmConversations2: many(dmConversations, { relationName: "user2" }),
  callsAsCaller: many(calls, { relationName: "caller" }),
  callsAsCallee: many(calls, { relationName: "callee" }),
}));

export const dmConversationsRelations = relations(dmConversations, ({ one, many }) => ({
  user1: one(users, { fields: [dmConversations.user1Id], references: [users.id], relationName: "user1" }),
  user2: one(users, { fields: [dmConversations.user2Id], references: [users.id], relationName: "user2" }),
  messages: many(directMessages),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  conversation: one(dmConversations, { fields: [directMessages.conversationId], references: [dmConversations.id] }),
  author: one(users, { fields: [directMessages.authorId], references: [users.id] }),
}));

export const communitiesRelations = relations(communities, ({ one, many }) => ({
  owner: one(users, { fields: [communities.ownerId], references: [users.id] }),
  categories: many(categories),
  channels: many(channels),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  community: one(communities, { fields: [categories.communityId], references: [communities.id] }),
  channels: many(channels),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  community: one(communities, { fields: [channels.communityId], references: [communities.id] }),
  category: one(categories, { fields: [channels.categoryId], references: [categories.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  parent: one(messages, { fields: [messages.parentId], references: [messages.id], relationName: "replies" }),
  replies: many(messages, { relationName: "replies" }),
  reactions: many(reactions),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  message: one(messages, { fields: [reactions.messageId], references: [messages.id] }),
  user: one(users, { fields: [reactions.userId], references: [users.id] }),
}));

export const callsRelations = relations(calls, ({ one, many }) => ({
  channel: one(channels, { fields: [calls.channelId], references: [channels.id] }),
  caller: one(users, { fields: [calls.callerId], references: [users.id], relationName: "caller" }),
  callee: one(users, { fields: [calls.calleeId], references: [users.id], relationName: "callee" }),
  participants: many(callParticipants),
}));

export const callParticipantsRelations = relations(callParticipants, ({ one }) => ({
  call: one(calls, { fields: [callParticipants.callId], references: [calls.id] }),
  user: one(users, { fields: [callParticipants.userId], references: [users.id] }),
}));

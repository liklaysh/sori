import { and, eq, not } from "drizzle-orm";
import type { Server } from "socket.io";
import { db } from "../db/index.js";
import { callLogs, directMessages, dmConversations } from "../db/schema.js";

export async function getConversationForUser(conversationId: string, userId: string) {
  const conversation = await db.query.dmConversations.findFirst({
    where: eq(dmConversations.id, conversationId),
  });

  if (!conversation) {
    return null;
  }

  if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
    return null;
  }

  return conversation;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  io?: Server | null,
) {
  const conversation = await getConversationForUser(conversationId, userId);

  if (!conversation) {
    return null;
  }

  await db.update(directMessages)
    .set({ isRead: true })
    .where(and(
      eq(directMessages.conversationId, conversationId),
      not(eq(directMessages.authorId, userId)),
    ));

  await db.update(callLogs)
    .set({ isRead: true })
    .where(and(
      eq(callLogs.conversationId, conversationId),
      eq(callLogs.calleeId, userId),
    ));

  if (io) {
    io.to(`user:${conversation.user1Id}`).emit("message_read", { conversationId, userId });
    io.to(`user:${conversation.user2Id}`).emit("message_read", { conversationId, userId });
  }

  return conversation;
}

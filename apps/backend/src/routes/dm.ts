import { Hono } from "hono";
import { db } from "../db/index.js";
import { dmConversations, directMessages, users, callLogs } from "../db/schema.js";
import { eq, or, and, desc, lt, like, sql, inArray, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authMiddleware } from "../middleware/auth.js";
import { safe } from "../utils/safe.js";
import { logger } from "../utils/logger.js";
import { getGlobalIo } from "../globals.js";
import { createDirectMessageSchema } from "../validation/schemas.js";
import { markConversationRead } from "../utils/dmRead.js";
import { extractAttachment, serializeMessage } from "../utils/messageContract.js";
import { getLinkPreviews } from "../utils/linkPreview.js";
import { sanitizeUser } from "../utils/publicUser.js";

const app = new Hono();

// Get all conversations for current user
app.get("/conversations", authMiddleware, safe(async (c) => {
  const jwt = (c.get("jwtPayload") || {}) as any;
  const userId = jwt.id;
  
  const convs = await db.query.dmConversations.findMany({
    where: or(
      eq(dmConversations.user1Id, userId),
      eq(dmConversations.user2Id, userId)
    ),
    with: {
      user1: true,
      user2: true,
      messages: {
        limit: 1,
        orderBy: [desc(directMessages.createdAt)]
      }
    },
    orderBy: [desc(dmConversations.updatedAt)]
  });

  // Filter out any conversations where internal role is adminpanel
  const filteredConvs = convs.filter((conv) => {
    return conv.user1Id !== conv.user2Id
      && conv.user1?.role !== "adminpanel"
      && conv.user2?.role !== "adminpanel";
  });

  const conversationIds = filteredConvs.map((conv) => conv.id);
  const unreadMessagesMap = new Map<string, number>();
  const unreadCallLogsMap = new Map<string, number>();

  if (conversationIds.length > 0) {
    const unreadMessages = await db.select({
      conversationId: directMessages.conversationId,
      count: sql<number>`count(*)`,
    })
      .from(directMessages)
      .where(and(
        inArray(directMessages.conversationId, conversationIds),
        eq(directMessages.isRead, false),
        ne(directMessages.authorId, userId),
      ))
      .groupBy(directMessages.conversationId);

    unreadMessages.forEach((row) => {
      unreadMessagesMap.set(row.conversationId, Number(row.count || 0));
    });

    const unreadCallLogs = await db.select({
      conversationId: callLogs.conversationId,
      count: sql<number>`count(*)`,
    })
      .from(callLogs)
      .where(and(
        inArray(callLogs.conversationId, conversationIds),
        eq(callLogs.isRead, false),
        eq(callLogs.calleeId, userId),
      ))
      .groupBy(callLogs.conversationId);

    unreadCallLogs.forEach((row) => {
      if (row.conversationId) {
        unreadCallLogsMap.set(row.conversationId, Number(row.count || 0));
      }
    });
  }

  const results = filteredConvs.map((conv) => {
    return {
      ...conv,
      user1: sanitizeUser(conv.user1),
      user2: sanitizeUser(conv.user2),
      messages: conv.messages.map((message) => serializeMessage(message)),
      unreadCount: (unreadMessagesMap.get(conv.id) || 0) + (unreadCallLogsMap.get(conv.id) || 0)
    };
  });

  return c.json(results);
}));

// Get or Create conversation with another user
app.post("/conversations", authMiddleware, safe(async (c) => {
  const { targetUserId } = await c.req.json();
  const jwt = (c.get("jwtPayload") || {}) as any;
  const userId = jwt.id;

  if (!targetUserId || targetUserId === userId) {
    return c.json({ error: "Invalid target user" }, 400);
  }

  // Verification: Block if target is adminpanel
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, targetUserId)
  });

  if (!targetUser || targetUser.role === 'adminpanel') {
    return c.json({ error: "You cannot message administrators" }, 403);
  }

  // Check if conversation already exists
  const [u1, u2] = [userId, targetUserId].sort();

  let conv = await db.query.dmConversations.findFirst({
    where: and(eq(dmConversations.user1Id, u1), eq(dmConversations.user2Id, u2)),
    with: {
      user1: true,
      user2: true
    }
  });

  if (!conv) {
    const id = nanoid();
    await db.insert(dmConversations).values({
      id,
      user1Id: u1,
      user2Id: u2
    });
    
    conv = await db.query.dmConversations.findFirst({
      where: eq(dmConversations.id, id),
      with: {
        user1: true,
        user2: true
      }
    });
  }

  return c.json(conv ? {
    ...conv,
    user1: sanitizeUser(conv.user1),
    user2: sanitizeUser(conv.user2),
  } : null);
}));

// Get messages for a conversation
app.get("/conversations/:id/messages", authMiddleware, safe(async (c) => {
  const convId = c.req.param("id");
  const jwt = (c.get("jwtPayload") || {}) as any;
  const userId = jwt.id;
  const before = c.req.query("before");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const query = c.req.query("q");

  // Verify user is part of the conversation
  const conv = await db.query.dmConversations.findFirst({
    where: eq(dmConversations.id, convId as string)
  });

  if (!conv || conv.user1Id === conv.user2Id || (conv.user1Id !== userId && conv.user2Id !== userId)) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  let msgConditions = [eq(directMessages.conversationId, convId as string)];
  let logConditions = [eq(callLogs.conversationId, convId as string)];

  if (query) {
    msgConditions.push(like(directMessages.content, `%${query}%`));
  }

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      msgConditions.push(lt(directMessages.createdAt, beforeDate));
      logConditions.push(lt(callLogs.createdAt, beforeDate));
    }
  }

  // Fetch messages
  const msgs = await db.query.directMessages.findMany({
    where: and(...msgConditions),
    with: {
      author: true
    },
    orderBy: [desc(directMessages.createdAt)],
    limit: limit
  });

  // Fetch relevant call logs
  const logs = query ? [] : await db.query.callLogs.findMany({
    where: and(...logConditions),
    orderBy: [desc(callLogs.createdAt)],
    limit: limit
  });

  // Format logs to match event structure
  const formattedLogs = logs.map(log => ({
    ...log,
    type: "system_call"
  }));

  // Merge and sort
  const combined = [...msgs.map((message) => serializeMessage(message)), ...formattedLogs]
    .sort((a: any, b: any) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    })
    .slice(0, limit);

  return c.json(combined.reverse());
}));

// Send a direct message
app.post("/conversations/:id/messages", authMiddleware, safe(async (c) => {
  try {
    const convId = c.req.param("id");
    const user = (c as any).get("user") || (c as any).get("jwtPayload") || {};
    const userId = user.id;
    const requestId = c.get("requestId");
    const body = await c.req.json();
    const parsed = createDirectMessageSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid message payload", details: parsed.error.format() }, 400);
    }

    const attachment = extractAttachment(parsed.data);
    const content = parsed.data.content?.trim() || "";
    const type = attachment ? "file" : "text";
    const linkPreviews = content ? await getLinkPreviews(content) : [];

    // Verify membership
    const conv = await db.query.dmConversations.findFirst({
      where: eq(dmConversations.id, convId!)
    });

    if (!conv || conv.user1Id === conv.user2Id || (conv.user1Id !== userId && conv.user2Id !== userId)) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const id = nanoid();
    const [msg] = await db.insert(directMessages).values({
      id,
      conversationId: convId!,
      authorId: userId,
      content,
      type,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileSize: attachment?.fileSize,
      fileType: attachment?.fileType,
      linkMetadata: linkPreviews.length > 0 ? JSON.stringify(linkPreviews) : null,
    }).returning();

    // Update conversation timestamp
    await db.update(dmConversations).set({ updatedAt: new Date() }).where(eq(dmConversations.id, convId!));

    const msgWithAuthor = await db.query.directMessages.findFirst({
      where: eq(directMessages.id, id),
      with: { author: true }
    });

    // Emit to both users in the conversation - Fixed global IO access
    const io = getGlobalIo();
    if (io) {
      const payload = {
        ...serializeMessage(msgWithAuthor),
        conversationId: convId,
        requestId,
      };
      io.to(`user:${conv.user1Id}`).emit("new_direct_message", payload);
      io.to(`user:${conv.user2Id}`).emit("new_direct_message", payload);
    }

    return c.json({
      ...serializeMessage(msgWithAuthor),
      conversationId: convId,
      requestId,
    });
  } catch (err: any) {
    logger.error("❌ Post DM error", { error: err as Error });
    return c.json({ error: "Internal Server Error" }, 500);
  }
}));

app.post("/conversations/:id/read", authMiddleware, safe(async (c) => {
  const conversationId = c.req.param("id");
  const jwt = (c.get("jwtPayload") || {}) as any;
  const requestId = c.get("requestId");
  const io = getGlobalIo();

  if (!conversationId) {
    return c.json({ error: "Conversation id is required" }, 400);
  }

  const conversation = await db.query.dmConversations.findFirst({
    where: eq(dmConversations.id, conversationId),
  });

  if (!conversation || conversation.user1Id === conversation.user2Id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const updatedConversation = await markConversationRead(conversationId, jwt.id, io);

  if (!updatedConversation) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json({ success: true, requestId });
}));

export default app;

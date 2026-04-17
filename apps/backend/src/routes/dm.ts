import { Hono } from "hono";
import { db } from "../db/index.js";
import { dmConversations, directMessages, users, callLogs } from "../db/schema.js";
import { eq, or, and, desc, asc, lt, gte, sql, not } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authMiddleware } from "../middleware/auth.js";
import { safe } from "../utils/safe.js";
import { logger } from "../utils/logger.js";
import { getGlobalIo } from "../globals.js";

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
  const filteredConvs = convs.filter(conv => {
    return conv.user1?.role !== 'adminpanel' && conv.user2?.role !== 'adminpanel';
  });

  // Calculate unread counts
  const results = await Promise.all(filteredConvs.map(async (conv) => {
    // 1. Unread Messages
    const [unreadMsgsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(directMessages)
      .where(and(
        eq(directMessages.conversationId, conv.id),
        eq(directMessages.isRead, false),
        eq(directMessages.authorId, conv.user1Id === userId ? conv.user2Id : conv.user1Id)
      ));

    // 2. Unread Call Logs (where current user was the receiver/callee)
    const [unreadCallsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .where(and(
        eq(callLogs.conversationId, conv.id),
        eq(callLogs.isRead, false),
        eq(callLogs.calleeId, userId) // Only count if I was called
      ));
    
    return {
      ...conv,
      unreadCount: (unreadMsgsResult?.count || 0) + (unreadCallsResult?.count || 0)
    };
  }));

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

  return c.json(conv);
}));

// Get messages for a conversation
app.get("/conversations/:id/messages", authMiddleware, safe(async (c) => {
  const convId = c.req.param("id");
  const jwt = (c.get("jwtPayload") || {}) as any;
  const userId = jwt.id;
  const before = c.req.query("before");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);

  // Verify user is part of the conversation
  const conv = await db.query.dmConversations.findFirst({
    where: eq(dmConversations.id, convId as string)
  });

  if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  let msgConditions = [eq(directMessages.conversationId, convId as string)];
  let logConditions = [eq(callLogs.conversationId, convId as string)];

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
    orderBy: [asc(directMessages.createdAt)],
    limit: limit
  });

  // Fetch relevant call logs
  const logs = await db.query.callLogs.findMany({
    where: and(...logConditions),
    orderBy: [asc(callLogs.createdAt)],
    limit: limit
  });

  // Format logs to match event structure
  const formattedLogs = logs.map(log => ({
    ...log,
    type: "system_call"
  }));

  // Merge and sort
  const combined = [...msgs, ...formattedLogs]
    .sort((a: any, b: any) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeA - timeB; // Chronological
    })
    .slice(0, limit);

  return c.json(combined);
}));

// Send a direct message
app.post("/conversations/:id/messages", authMiddleware, safe(async (c) => {
  try {
    const convId = c.req.param("id");
    const user = (c as any).get("user") || (c as any).get("jwtPayload") || {};
    const userId = user.id;
    const { content, type = "text", fileUrl, fileName, fileSize, fileType } = await c.req.json();

    if (!content && type !== "file") {
      return c.json({ error: "Message content is required" }, 400);
    }

    // Verify membership
    const conv = await db.query.dmConversations.findFirst({
      where: eq(dmConversations.id, convId!)
    });

    if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const id = nanoid();
    const [msg] = await db.insert(directMessages).values({
      id,
      conversationId: convId!,
      authorId: userId,
      content: content || "",
      type,
      fileUrl,
      fileName,
      fileSize,
      fileType
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
      io.to(`user:${conv.user1Id}`).emit("new_direct_message", msgWithAuthor);
      io.to(`user:${conv.user2Id}`).emit("new_direct_message", msgWithAuthor);
    }

    return c.json(msgWithAuthor);
  } catch (err: any) {
    logger.error("❌ Post DM error", { error: err as Error });
    return c.json({ error: "Internal Server Error" }, 500);
  }
}));

export default app;

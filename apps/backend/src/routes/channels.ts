import { Hono } from "hono";
import { db } from "../db/index.js";
import { channels, messages, users } from "../db/schema.js";
import { eq, and, like, desc, lt } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { nanoid } from "nanoid";
import { safe } from "../utils/safe.js";
import { logger } from "../utils/logger.js";
import { getGlobalIo } from "../globals.js";
import { createChannelMessageSchema } from "../validation/schemas.js";
import { extractAttachments, serializeMessage } from "../utils/messageContract.js";
import { getLinkPreviews } from "../utils/linkPreview.js";
import { validateAttachmentsBelongToUser } from "../utils/attachmentRegistry.js";

const router = new Hono();

router.use("*", authMiddleware);

router.patch("/:channelId", async (c) => {
  const channelId = c.req.param("channelId");
  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Channel name is required" }, 400);

  await db.update(channels).set({ name }).where(eq(channels.id, channelId));
  return c.json({ success: true });
});

router.delete("/:channelId", async (c) => {
  const channelId = c.req.param("channelId");
  await db.delete(channels).where(eq(channels.id, channelId));
  return c.json({ success: true });
});

router.get("/:channelId/messages", safe(async (c) => {
  try {
    const channelId = c.req.param("channelId");
    const before = c.req.query("before");
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
    const query = c.req.query("q");
    
    let conditions = [eq(messages.channelId, channelId!)];
    if (query) {
      conditions.push(like(messages.content, `%${query}%`));
    }
    
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        conditions.push(lt(messages.createdAt, beforeDate));
      }
    }

    const result = await db.query.messages.findMany({
      where: and(...conditions),
      with: {
        author: true,
        parent: {
          with: { author: true }
        },
        reactions: {
          with: { user: true }
        }
      },
      orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      limit: limit
    });

    return c.json(result.reverse().map((message) => serializeMessage(message)));
  } catch (err: any) {
    logger.error("❌ Fetch messages error", { error: err as Error });
    return c.json({ error: "Internal Server Error", details: err.message }, 500);
  }
}));

router.post("/:channelId/messages", safe(async (c) => {
  try {
    const channelId = c.req.param("channelId");
    const user = ((c as any).get("user") || (c as any).get("jwtPayload") || {}) as any;
    const requestId = c.get("requestId");
    const body = await c.req.json();
    const parsed = createChannelMessageSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid message payload", details: parsed.error.format() }, 400);
    }

    const attachments = extractAttachments(parsed.data);
    await validateAttachmentsBelongToUser(attachments, user.id);
    const firstAttachment = attachments[0] || null;
    const parentId = parsed.data.parentId || null;
    const content = parsed.data.content?.trim() || "";
    const effectiveType = attachments.length > 0 ? "file" : "text";
    const linkPreviews = content ? await getLinkPreviews(content) : [];

    const id = nanoid();
    const [newMessage] = await db.insert(messages).values({
      id,
      channelId,
      authorId: user.id,
      content,
      parentId,
      type: effectiveType,
      fileUrl: firstAttachment?.fileUrl,
      fileName: firstAttachment?.fileName,
      fileSize: firstAttachment?.fileSize,
      fileType: firstAttachment?.fileType,
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
      linkMetadata: linkPreviews.length > 0 ? JSON.stringify(linkPreviews) : null,
    }).returning();

    const messageWithAuthor = await db.query.messages.findFirst({
      where: eq(messages.id, id),
      with: {
        author: true,
        parent: { with: { author: true } }
      }
    });

    const io = getGlobalIo();
    if (io && typeof channelId === 'string') {
      io.to(channelId).emit("new_message", {
        ...serializeMessage(messageWithAuthor),
        requestId,
      });
    }

    return c.json({
      ...serializeMessage(messageWithAuthor),
      requestId,
    });
  } catch (err: any) {
    logger.error("❌ Post message error", { error: err as Error });
    return c.json({ error: "Internal Server Error" }, 500);
  }
}));

export default router;

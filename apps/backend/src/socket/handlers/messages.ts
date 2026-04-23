import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import { db } from "../../db/index.js";
import { messages, reactions, dmConversations, directMessages } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { sendMessageSchema, sendDirectMessageSchema } from "../../validation/schemas.js";
import { getLinkPreviews } from "../../utils/linkPreview.js";
import { logger } from "../../utils/logger.js";
import { extractAttachments, serializeMessage } from "../../utils/messageContract.js";

export function handleMessages(io: Server, socket: Socket, user: { id: string, username: string }, isAdminPanel: boolean) {

  socket.on("send_message", async (data: any) => {
    if (isAdminPanel) return;
    try {
      const result = sendMessageSchema.safeParse(data);
      if (!result.success) {
        return socket.emit("error", { message: "Invalid message data", details: result.error.format() });
      }
      const { channelId } = result.data;
      const content = result.data.content?.trim() || "";
      const parentId = result.data.parentId || null;
      const attachments = extractAttachments(result.data);
      const firstAttachment = attachments[0] || null;
      const requestId = result.data.requestId || socket.data.requestId;

      const messageId = nanoid();
      const linkPreviews = content ? await getLinkPreviews(content) : [];

      await db.insert(messages).values({
        id: messageId,
        content,
        authorId: user.id,
        channelId,
        parentId,
        fileUrl: firstAttachment?.fileUrl,
        fileName: firstAttachment?.fileName,
        fileSize: firstAttachment?.fileSize,
        fileType: firstAttachment?.fileType,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        type: attachments.length > 0 ? "file" : "text",
        linkMetadata: linkPreviews.length > 0 ? JSON.stringify(linkPreviews) : null,
        createdAt: new Date()
      });

      const newMessage = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        with: {
          author: true,
          parent: { with: { author: true } },
          reactions: { with: { user: true } }
        }
      });

      io.to(channelId).emit("new_message", {
        ...serializeMessage(newMessage),
        requestId,
      });
    } catch (err: any) {
      logger.error("[Messages] Send Error", { error: err });
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("edit_message", async (data: { messageId: string, content: string }) => {
    try {
      const { messageId, content } = data;
      const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
      if (!msg || msg.authorId !== user.id) return;

      await db.update(messages)
        .set({ content, isEdited: true, editedAt: new Date() })
        .where(eq(messages.id, messageId));

      io.to(msg.channelId!).emit("message_updated", {
        id: messageId,
        content,
        isEdited: true,
        editedAt: new Date().toISOString()
      });
    } catch (err) { logger.error("[Messages] Edit Error", { error: err }); }
  });

  socket.on("delete_message", async (messageId: string) => {
    try {
      const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
      if (!msg || msg.authorId !== user.id) return;

      await db.update(messages)
        .set({ isDeleted: true, content: "This message was deleted." })
        .where(eq(messages.id, messageId));

      io.to(msg.channelId!).emit("message_deleted", messageId);
    } catch (err) { logger.error("[Messages] Delete Error", { error: err }); }
  });

  socket.on("add_reaction", async (data: { messageId: string, emoji: string }) => {
    try {
      const { messageId, emoji } = data;
      const existing = await db.query.reactions.findFirst({
        where: and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, user.id),
          eq(reactions.emoji, emoji)
        )
      });
      if (existing) return;

      await db.insert(reactions).values({ id: nanoid(), messageId, userId: user.id, emoji });
      const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
      if (msg) {
        io.to(msg.channelId!).emit("reaction_added", { messageId, emoji, userId: user.id });
      }
    } catch (err) { logger.error("[Messages] Reaction Error", { error: err }); }
  });

  socket.on("remove_reaction", async (data: { messageId: string, emoji: string }) => {
    try {
      const { messageId, emoji } = data;
      await db.delete(reactions).where(and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, user.id),
        eq(reactions.emoji, emoji)
      ));
      const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
      if (msg) {
        io.to(msg.channelId!).emit("reaction_removed", { messageId, emoji, userId: user.id });
      }
    } catch (err) { logger.error("[Messages] Un-Reaction Error", { error: err }); }
  });

  socket.on("send_direct_message", async (data: any) => {
    try {
      const result = sendDirectMessageSchema.safeParse(data);
      if (!result.success) {
        return socket.emit("error", { message: "Invalid DM data", details: result.error.format() });
      }
      const { conversationId } = result.data;
      const content = result.data.content?.trim() || "";
      const attachments = extractAttachments(result.data);
      const firstAttachment = attachments[0] || null;
      const requestId = result.data.requestId || socket.data.requestId;

      const conv = await db.query.dmConversations.findFirst({
        where: eq(dmConversations.id, conversationId)
      });
      if (!conv || (conv.user1Id !== user.id && conv.user2Id !== user.id)) return;

      const messageId = nanoid();
      const linkPreviews = content ? await getLinkPreviews(content) : [];

      await db.insert(directMessages).values({
        id: messageId,
        conversationId,
        content,
        authorId: user.id,
        fileUrl: firstAttachment?.fileUrl,
        fileName: firstAttachment?.fileName,
        fileSize: firstAttachment?.fileSize,
        fileType: firstAttachment?.fileType,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        type: attachments.length > 0 ? "file" : "text",
        linkMetadata: linkPreviews.length > 0 ? JSON.stringify(linkPreviews) : null,
        createdAt: new Date()
      });

      await db.update(dmConversations)
        .set({ updatedAt: new Date() })
        .where(eq(dmConversations.id, conversationId));

      const newMessage = await db.query.directMessages.findFirst({
        where: eq(directMessages.id, messageId),
        with: { author: true }
      });

      const payload = {
        ...serializeMessage(newMessage),
        conversationId,
        requestId,
      };

      io.to(`user:${conv.user1Id}`).emit("new_direct_message", payload);
      io.to(`user:${conv.user2Id}`).emit("new_direct_message", payload);

      logger.debug(`[Socket] DM Message delivered: ${messageId}`, { conversationId });
    } catch (err) { logger.error("[Messages] DM Send Error", { error: err }); }
  });

}

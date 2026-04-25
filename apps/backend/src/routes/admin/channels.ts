import { Hono } from "hono";
import { db } from "../../db/index.js";
import { channels, messages, reactions, calls, callParticipants } from "../../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { logAudit } from "../../utils/audit.js";
import { logger } from "../../utils/logger.js";

const channelsAdmin = new Hono();

const channelUpdateSchema = z.object({
  name: z.string().min(1).max(32).regex(/^[a-z0-9-_]+$/).optional(),
  type: z.enum(["text", "voice"]).optional(),
  categoryId: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/).nullable().optional(),
  order: z.number().int().min(0).optional(),
}).strict();

channelsAdmin.get("/", async (c) => {
  const allChannels = await db.select().from(channels).orderBy(channels.order);
  return c.json(allChannels);
});

channelsAdmin.post("/", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const { name, type, communityId, categoryId } = await c.req.json() as { name: string, type: "text" | "voice", communityId?: string, categoryId?: string };
  const id = nanoid();

  const targetCommunityId = communityId || "default-community";
  let targetCategoryId = categoryId;
  
  if (!targetCategoryId) {
    targetCategoryId = type === "voice" ? "cat-voice" : "cat-text";
  }

  await db.insert(channels).values({
    id,
    name,
    type: type || "text",
    communityId: targetCommunityId,
    categoryId: targetCategoryId
  });
  await logAudit(payload.id || "system", "created_channel", name);
  return c.json({ success: true, id });
});

channelsAdmin.patch("/:id", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const channelId = c.req.param("id");
  const parsed = channelUpdateSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid channel update", details: parsed.error.format() }, 400);
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }
  
  await db.update(channels).set(updates).where(eq(channels.id, channelId));
  await logAudit(payload.id || "system", "updated_channel", channelId, updates);
  return c.json({ success: true });
});

channelsAdmin.delete("/:id", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const channelId = c.req.param("id");
  
  try {
    const channelCalls = await db.select({ id: calls.id }).from(calls).where(eq(calls.channelId, channelId));
    for (const call of channelCalls) {
      await db.delete(callParticipants).where(eq(callParticipants.callId, call.id));
    }
    await db.delete(calls).where(eq(calls.channelId, channelId));
    await db.update(messages).set({ parentId: null }).where(eq(messages.channelId, channelId));

    const chanMessages = await db.select({ id: messages.id }).from(messages).where(eq(messages.channelId, channelId));
    const mIds = chanMessages.map(m => m.id);
    if (mIds.length > 0) {
      await db.delete(reactions).where(inArray(reactions.messageId, mIds));
    }
    await db.delete(messages).where(eq(messages.channelId, channelId));
    await db.delete(channels).where(eq(channels.id, channelId));

    await logAudit(payload.id || "system", "deleted_channel", channelId);
    return c.json({ success: true });
  } catch (err: any) {
    logger.error("Channel deletion failed", err);
    return c.json({ error: `Failed to delete channel: ${err.message || 'Database constraint error'}` }, 500);
  }
});

export default channelsAdmin;

import { Hono } from "hono";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { users, communities, members, categories, channels } from "../db/schema.js";
import { eq, ne, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { redisPresence } from "../utils/redis.js";

import { createChannelSchema, createCategorySchema } from "../validation/schemas.js";

import { normalizeS3Url } from "../utils/url.js";
import { safe } from "../utils/safe.js";

const router = new Hono();

router.use("*", authMiddleware);

// GET / - List all communities for the user
router.get("/", safe(async (c) => {
  const user = (c.get("jwtPayload") || {}) as any;
  // For now, return the default community + any communities where user is a member
  const result = await db.select({
    id: communities.id,
    name: communities.name,
    iconUrl: communities.iconUrl,
  })
  .from(members)
  .leftJoin(communities, eq(members.communityId, communities.id))
  .where(eq(members.userId, user.id));

  const normalizedResult = result.map(comm => ({
    ...comm,
    iconUrl: normalizeS3Url(comm.iconUrl)
  }));

  return c.json(normalizedResult);
}));

router.get("/:communityId/members", safe(async (c) => {
  const communityId = c.req.param("communityId");
  const result = await db.select({
    id: users.id,
    username: users.username,
    avatarUrl: users.avatarUrl,
    role: members.role,
  })
  .from(members)
  .leftJoin(users, eq(members.userId, users.id))
  .where(and(
    eq(members.communityId, communityId as string),
    ne(users.role, 'adminpanel')
  ));

  const userIds = result.map(m => m.id).filter((id): id is string => !!id);
  const onlineUsers = await redisPresence.isBatchOnline(userIds);

  const membersWithStatus = result.map((m) => {
    return {
      ...m,
      avatarUrl: normalizeS3Url(m.avatarUrl),
      status: m.id && onlineUsers.has(m.id) ? "online" : "offline"
    };
  });

  return c.json(membersWithStatus);
}));

router.post("/", safe(async (c) => {
  const user = (c.get("jwtPayload") || {}) as any;
  const { name, iconUrl } = await c.req.json();
  if (!name) return c.json({ error: "Community name is required" }, 400);

  const communityId = nanoid();
  await db.insert(communities).values({ id: communityId, name, iconUrl, ownerId: user.id });
  await db.insert(members).values({ userId: user.id, communityId, role: "owner" });

  const textCatId = nanoid();
  const voiceCatId = nanoid();
  await db.insert(categories).values([
    { id: textCatId, name: "Text Channels", communityId, order: 0 },
    { id: voiceCatId, name: "Voice Channels", communityId, order: 1 }
  ]);

  return c.json({ id: communityId, name });
}));

router.get("/:communityId/categories", safe(async (c) => {
  const communityId = c.req.param("communityId");
  const result = await db.query.categories.findMany({
    where: eq(categories.communityId, communityId as string),
    orderBy: categories.order,
  });
  return c.json(result);
}));

router.post("/:communityId/categories", safe(async (c) => {
  const communityId = c.req.param("communityId");
  const body = await c.req.json();
  const result = createCategorySchema.safeParse(body);
  if (!result.success) return c.json({ error: "Invalid input", details: result.error.format() }, 400);

  const { name } = result.data;
  const id = nanoid();
  await db.insert(categories).values({ id, name, communityId, order: 100 });
  return c.json({ id, name });
}));

router.get("/:communityId/channels", safe(async (c) => {
  const communityId = c.req.param("communityId");
  const result = await db.query.channels.findMany({
    where: eq(channels.communityId, communityId as string),
    orderBy: channels.order,
  });
  return c.json(result);
}));

router.post("/:communityId/channels", safe(async (c) => {
  const communityId = c.req.param("communityId");
  const body = await c.req.json();
  const result = createChannelSchema.safeParse(body);
  
  if (!result.success) return c.json({ error: "Invalid input", details: result.error.format() }, 400);

  const { name, type, categoryId } = result.data;
  const channelId = nanoid();
  await db.insert(channels).values({
    id: channelId,
    name,
    type: type || "text",
    communityId,
    categoryId: categoryId || null,
    order: 100
  });

  return c.json({ id: channelId, name, type, categoryId });
}));

export default router;

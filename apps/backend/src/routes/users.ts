import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, and, ne, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { safe } from "../utils/safe.js";
import { getGlobalIo } from "../globals.js";
import { normalizeS3Url } from "../utils/url.js";
import { logger } from "../utils/logger.js";

const app = new Hono();

app.patch("/me", authMiddleware, safe(async (c) => {
  const jwt = (c.get("jwtPayload") || {}) as any;
  const userId = jwt.id;
  const { username, avatarUrl, noiseSuppression, micGain, outputVolume } = await c.req.json();

  try {
    await db.update(users)
      .set({ 
        username: username || undefined, 
        avatarUrl: avatarUrl || undefined,
        noiseSuppression: noiseSuppression !== undefined ? noiseSuppression : undefined,
        micGain: micGain !== undefined ? micGain : undefined,
        outputVolume: outputVolume !== undefined ? outputVolume : undefined
      })
      .where(eq(users.id, userId));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!updatedUser) return c.json({ error: "User not found" }, 404);

    const responseData = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      avatarUrl: normalizeS3Url(updatedUser.avatarUrl),
      noiseSuppression: updatedUser.noiseSuppression,
      micGain: updatedUser.micGain,
      outputVolume: updatedUser.outputVolume
    };

    const io = getGlobalIo();
    if (io) {
      io.emit("user_updated", {
        id: updatedUser.id,
        username: updatedUser.username,
        avatarUrl: normalizeS3Url(updatedUser.avatarUrl),
        status: updatedUser.status
      });
    }

    return c.json(responseData);
  } catch (err) {
    logger.error("❌ [Users] Update failed", { error: err as Error });
    return c.json({ error: "Update failed" }, 500);
  }
}));

// Search users for DM
app.get("/search", authMiddleware, safe(async (c) => {
  const query = c.req.query("q") || "";
  if (query.length < 2) return c.json([]);

  const jwt = (c.get("jwtPayload") || {}) as any;

  try {
    const results = await db.select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      status: users.status
    })
    .from(users)
    .where(and(
      ne(users.id, jwt.id), // Don't search for self
      ne(users.role, 'adminpanel'), // Hide admins
      sql`(${users.username} ILIKE ${'%' + query + '%'} OR ${users.email} ILIKE ${'%' + query + '%'})`
    ))
    .limit(10);

    const normalizedResults = results.map(u => ({
      ...u,
      avatarUrl: normalizeS3Url(u.avatarUrl)
    }));

    return c.json(normalizedResults);
  } catch (err) {
    logger.error("❌ [Users] Search failed", { error: err as Error });
    return c.json({ error: "Search failed" }, 500);
  }
}));

export default app;

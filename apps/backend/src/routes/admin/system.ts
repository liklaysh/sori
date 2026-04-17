import { Hono } from "hono";
import { db } from "../../db/index.js";
import { users, serverSettings, calls } from "../../db/schema.js";
import { sql, count, ne, lt } from "drizzle-orm";
import { logAudit } from "../../utils/audit.js";
import { s3Client, BUCKET_NAME } from "../../utils/s3.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

const system = new Hono();

// Dashboard Stats
system.get("/stats", async (c) => {
  const memUsage = process.memoryUsage();
  
  const dbUsers = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(ne(users.role, "deleted"));

  const userCount = (dbUsers[0]?.count as number) || 0;
  
  return c.json({
    uptime: process.uptime(),
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
    },
    totalUsers: userCount,
  });
});

// Settings Management
system.get("/settings", async (c) => {
  const settings = await db.select().from(serverSettings);
  const result: Record<string, string> = {};
  settings.forEach((s: { key: string, value: string }) => result[s.key] = s.value);
  return c.json(result);
});

system.patch("/settings", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const body = await c.req.json() as { key: string, value: string };
  const { key, value } = body;
  if (!key || value === undefined) return c.json({ error: "Missing key or value" }, 400);

  await db.insert(serverSettings).values({ key, value })
    .onConflictDoUpdate({ target: serverSettings.key, set: { value, updatedAt: new Date() } });

  await logAudit(payload.id || "system", "updated_setting", key, { newValue: value });
  return c.json({ success: true, key, value });
});

// Call History
system.get("/calls", async (c) => {
  // Automatic Telemetry Cleanup: 72 Hour Threshold
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
  try {
    await db.delete(calls).where(lt(calls.startedAt, seventyTwoHoursAgo));
  } catch (e) {
    console.error("Purification failed:", e);
  }

  const callLogs = await db.query.calls.findMany({
    orderBy: (calls, { desc }) => [desc(calls.startedAt)],
    limit: 50,
    with: {
      channel: true,
      caller: true,
      callee: true,
      participants: {
        with: {
          user: true
        }
      }
    }
  });

  // Since I haven't added explicit relations for caller/callee yet (just raw IDs),
  // I'll do a join or just return raw with info if I update schema relations.
  // Actually, I'll just fetch users separately or add relations now.
  
  return c.json(callLogs);
});

export default system;

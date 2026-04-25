import { Hono } from "hono";
import { db } from "../../db/index.js";
import { users, serverSettings, calls } from "../../db/schema.js";
import { sql, ne } from "drizzle-orm";
import { logAudit } from "../../utils/audit.js";
import { s3Client, BUCKET_NAME } from "../../utils/s3.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { redisCallTelemetry } from "../../utils/redis.js";
import { sanitizeUser } from "../../utils/publicUser.js";

const system = new Hono();

// Dashboard Stats
system.get("/stats", async (c) => {
  const memUsage = process.memoryUsage();
  
  const dbUsers = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(ne(users.role, "deleted"));

  const userCount = Number(dbUsers[0]?.count || 0);
  
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
  const callLogs = await db.query.calls.findMany({
    orderBy: (calls, { desc }) => [desc(calls.startedAt)],
    limit: 50,
    with: {
      channel: true,
      caller: {
        columns: {
          id: true,
          username: true,
          avatarUrl: true,
          status: true,
          role: true,
        },
      },
      callee: {
        columns: {
          id: true,
          username: true,
          avatarUrl: true,
          status: true,
          role: true,
        },
      },
      participants: {
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              avatarUrl: true,
              status: true,
              role: true,
            },
          }
        }
      }
    }
  });

  const liveTelemetry = await redisCallTelemetry.getAllTelemetry();

  return c.json(callLogs.map((call) => {
    const runtime = liveTelemetry[call.id];
    const sanitizedCall = {
      ...call,
      caller: sanitizeUser(call.caller),
      callee: sanitizeUser(call.callee),
      participants: call.participants.map((participant) => ({
        ...participant,
        user: sanitizeUser(participant.user),
      })),
    };

    if (!runtime || !call.isActive) {
      return sanitizedCall;
    }

    return {
      ...sanitizedCall,
      mos: runtime.qualityScore !== null ? runtime.qualityScore.toFixed(1) : call.mos,
      avgBitrate: runtime.avgBitrate ?? call.avgBitrate,
      packetLoss: runtime.avgPacketLoss !== null ? runtime.avgPacketLoss.toFixed(1) : call.packetLoss,
      avgJitterMs: runtime.avgJitterMs ?? call.avgJitterMs,
      avgRttMs: runtime.avgRttMs ?? call.avgRttMs,
      reconnectCount: runtime.reconnectCount ?? call.reconnectCount,
      telemetrySamples: runtime.sampleCount ?? call.telemetrySamples,
      connectionQuality: runtime.connectionQuality !== "unknown" ? runtime.connectionQuality : call.connectionQuality,
      participantCount: runtime.participantCount || call.participants.length || undefined,
      lastTelemetryAt: runtime.updatedAt,
    };
  }));
});

export default system;

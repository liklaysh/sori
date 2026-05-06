import { Hono } from "hono";
import { db, migrationClient } from "../../db/index.js";
import { users, serverSettings, calls } from "../../db/schema.js";
import { sql, ne } from "drizzle-orm";
import { logAudit } from "../../utils/audit.js";
import { s3Client, BUCKET_NAME } from "../../utils/s3.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { redis, redisCallTelemetry } from "../../utils/redis.js";
import { sanitizeUser } from "../../utils/publicUser.js";
import {
  diagnoseTelemetryDegradation,
  hydrateTelemetryAggregate,
  normalizeConnectionQuality,
  type CallTelemetryAggregate,
} from "../../utils/callTelemetry.js";
import { getSystemVersion } from "../../utils/version.js";
import { config } from "../../config.js";

const system = new Hono();

const TELEMETRY_COLUMNS = [
  "avg_jitter_ms",
  "avg_rtt_ms",
  "reconnect_count",
  "telemetry_samples",
  "connection_quality",
  "min_bitrate",
  "max_packet_loss",
  "max_jitter_ms",
  "max_rtt_ms",
  "avg_connection_quality",
  "excellent_samples",
  "good_samples",
  "poor_samples",
  "lost_samples",
];

async function checkDatabase() {
  const startedAt = Date.now();
  await db.execute(sql`select 1`);
  return Date.now() - startedAt;
}

async function checkRedis() {
  const startedAt = Date.now();
  const ping = await redis.ping();
  if (ping !== "PONG") {
    throw new Error(`Unexpected Redis response: ${ping}`);
  }
  return Date.now() - startedAt;
}

async function checkStorage() {
  const startedAt = Date.now();
  await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  return Date.now() - startedAt;
}

async function getMigrationDiagnostics() {
  const rows = await migrationClient`
    select id, hash, created_at
    from drizzle.__drizzle_migrations
    order by created_at desc
  `.catch(() => [] as any[]);

  return {
    appliedCount: rows.length,
    latest: rows[0] ? {
      id: rows[0].id,
      hash: rows[0].hash,
      createdAt: rows[0].created_at ? new Date(Number(rows[0].created_at)).toISOString() : null,
    } : null,
  };
}

async function getTelemetrySchemaDiagnostics() {
  const rows = await migrationClient`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calls'
      and column_name = any(${TELEMETRY_COLUMNS})
  `.catch(() => [] as any[]);

  const presentColumns = new Set((rows as Array<{ column_name: string }>).map((row) => row.column_name));
  const missingColumns = TELEMETRY_COLUMNS.filter((column) => !presentColumns.has(column));

  return {
    status: missingColumns.length === 0 ? "ok" : "degraded",
    expectedColumns: TELEMETRY_COLUMNS.length,
    presentColumns: presentColumns.size,
    missingColumns,
  };
}

function callPersistedTelemetry(call: typeof calls.$inferSelect): Partial<CallTelemetryAggregate> {
  return {
    sampleCount: call.telemetrySamples ?? 0,
    avgBitrate: call.avgBitrate,
    minBitrate: call.minBitrate,
    avgPacketLoss: call.packetLoss !== null ? Number(call.packetLoss) : null,
    maxPacketLoss: call.maxPacketLoss !== null ? Number(call.maxPacketLoss) : null,
    avgJitterMs: call.avgJitterMs,
    maxJitterMs: call.maxJitterMs,
    avgRttMs: call.avgRttMs,
    maxRttMs: call.maxRttMs,
    reconnectCount: call.reconnectCount ?? 0,
    connectionQuality: normalizeConnectionQuality(call.connectionQuality),
    avgConnectionQuality: normalizeConnectionQuality(call.avgConnectionQuality),
    excellentSamples: call.excellentSamples ?? 0,
    goodSamples: call.goodSamples ?? 0,
    poorSamples: call.poorSamples ?? 0,
    lostSamples: call.lostSamples ?? 0,
  };
}

async function resolveServiceStatus(check: () => Promise<number>) {
  try {
    const latency = await check();
    return { status: "ok", latency };
  } catch (error) {
    return {
      status: "error",
      latency: null,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

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
    const runtime = hydrateTelemetryAggregate(liveTelemetry[call.id]);
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
      return {
        ...sanitizedCall,
        degradationReasons: diagnoseTelemetryDegradation(callPersistedTelemetry(call)),
      };
    }

    const liveCall = {
      mos: runtime.qualityScore !== null ? runtime.qualityScore.toFixed(1) : call.mos,
      avgBitrate: runtime.avgBitrate ?? call.avgBitrate,
      minBitrate: runtime.minBitrate ?? call.minBitrate,
      packetLoss: runtime.avgPacketLoss !== null ? runtime.avgPacketLoss.toFixed(1) : call.packetLoss,
      maxPacketLoss: runtime.maxPacketLoss !== null ? runtime.maxPacketLoss.toFixed(1) : call.maxPacketLoss,
      avgJitterMs: runtime.avgJitterMs ?? call.avgJitterMs,
      maxJitterMs: runtime.maxJitterMs ?? call.maxJitterMs,
      avgRttMs: runtime.avgRttMs ?? call.avgRttMs,
      maxRttMs: runtime.maxRttMs ?? call.maxRttMs,
      reconnectCount: runtime.reconnectCount ?? call.reconnectCount,
      telemetrySamples: runtime.sampleCount ?? call.telemetrySamples,
      connectionQuality: runtime.connectionQuality !== "unknown" ? runtime.connectionQuality : call.connectionQuality,
      avgConnectionQuality: runtime.avgConnectionQuality !== "unknown" ? runtime.avgConnectionQuality : call.avgConnectionQuality,
      excellentSamples: runtime.excellentSamples ?? call.excellentSamples,
      goodSamples: runtime.goodSamples ?? call.goodSamples,
      poorSamples: runtime.poorSamples ?? call.poorSamples,
      lostSamples: runtime.lostSamples ?? call.lostSamples,
      participantCount: runtime.participantCount || call.participants.length || undefined,
      lastTelemetryAt: runtime.updatedAt,
      degradationReasons: diagnoseTelemetryDegradation(runtime),
    };

    return {
      ...sanitizedCall,
      ...liveCall,
    };
  }));
});

system.get("/diagnostics", async (c) => {
  const [database, valkey, storage, migrations, telemetrySchema] = await Promise.all([
    resolveServiceStatus(checkDatabase),
    resolveServiceStatus(checkRedis),
    resolveServiceStatus(checkStorage),
    getMigrationDiagnostics(),
    getTelemetrySchemaDiagnostics(),
  ]);

  const serviceStatuses = [database.status, valkey.status, storage.status, telemetrySchema.status];
  const status = serviceStatuses.every((serviceStatus) => serviceStatus === "ok")
    ? "ok"
    : serviceStatuses.some((serviceStatus) => serviceStatus === "ok")
      ? "degraded"
      : "down";

  return c.json({
    status,
    generatedAt: new Date().toISOString(),
    version: getSystemVersion(),
    services: {
      database,
      valkey,
      storage,
    },
    migrations,
    telemetrySchema,
    runtime: {
      environment: config.env,
      uptime: Math.round(process.uptime()),
      node: process.version,
      retentionDays: config.storage.logRetentionDays,
      maxUploadSizeMb: config.storage.maxUploadSizeMb,
    },
    endpoints: {
      web: config.public.webUrl,
      api: config.public.apiUrl,
      ws: config.public.wsUrl,
      livekit: config.public.livekitUrl,
      media: config.public.mediaUrl,
      health: `${config.public.apiUrl.replace(/\/+$/, "")}/health`,
      bootstrap: `${config.public.webUrl.replace(/\/+$/, "")}/.well-known/sori/client.json`,
    },
  });
});

export default system;

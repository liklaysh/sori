import { Redis } from "ioredis";
import { createHash, randomUUID } from "node:crypto";
import { config } from "../config.js";
import { logger } from "./logger.js";
import { mergeTelemetryAggregate, type CallTelemetryAggregate, type CallTelemetrySample } from "./callTelemetry.js";

const REDIS_URL = config.redis.url;
const DIRECT_CALL_PREFIX = "active_direct_call:";
const DIRECT_CALL_TTL_SECONDS = 3600;
const CALL_TELEMETRY_PREFIX = "call_telemetry:";
const CALL_TELEMETRY_TTL_SECONDS = 4 * 60 * 60;
const VOICE_LIFECYCLE_RECENT_KEY = "voice_lifecycle:recent";
const VOICE_LIFECYCLE_USER_PREFIX = "voice_lifecycle:user:";
const VOICE_LIFECYCLE_DEDUPE_PREFIX = "voice_lifecycle:dedupe:";
const VOICE_LIFECYCLE_RATE_PREFIX = "voice_lifecycle:rate:";
const CLIENT_SIGNAL_RECENT_KEY = "client_signal:recent";
const CLIENT_SIGNAL_LATEST_PREFIX = "client_signal:latest:";
const CLIENT_SIGNAL_SOCKET_PREFIX = "client_signal:socket:";
const VOICE_LIFECYCLE_TTL_SECONDS = 3 * 24 * 60 * 60;
const VOICE_LIFECYCLE_DEDUPE_SECONDS = 20;
const VOICE_LIFECYCLE_RATE_WINDOW_SECONDS = 60 * 60;
const VOICE_LIFECYCLE_RATE_LIMIT = 120;
const VOICE_LIFECYCLE_RECENT_LIMIT = 500;
const VOICE_LIFECYCLE_USER_LIMIT = 100;
const CLIENT_SIGNAL_RECENT_LIMIT = 300;

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const pubClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const subClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err: any) => logger.error("[Redis] Error:", { error: err }));
redis.on("connect", () => logger.info("[Redis] Connected to Valkey/Redis"));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRedisLock<T>(
  lockKey: string,
  ttlMs: number,
  operation: () => Promise<T>,
  options: { retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const token = randomUUID();
  const retries = options.retries ?? 5;
  const retryDelayMs = options.retryDelayMs ?? 25;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
    if (acquired === "OK") {
      try {
        return await operation();
      } finally {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          token,
        );
      }
    }

    if (attempt < retries) {
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`Failed to acquire Redis lock: ${lockKey}`);
}

/**
 * Helper to manage online users in Redis
 */
export const redisPresence = {
  addUserSocket: async (userId: string, socketId: string) => {
    await redis.sadd(`presence:${userId}`, socketId);
    await redis.sadd(`global:presence`, userId);
    // Heartbeat key for this specific socket
    await redis.set(`socket:hb:${socketId}`, userId, "EX", 90);
    await redis.expire(`presence:${userId}`, 86400); 
    await redis.expire(`global:presence`, 86400);
  },
  removeUserSocket: async (userId: string, socketId: string) => {
    await redis.srem(`presence:${userId}`, socketId);
    await redis.del(`socket:hb:${socketId}`);
    const stillOnline = await redisPresence.isUserOnline(userId);
    if (!stillOnline) {
      await redis.srem(`global:presence`, userId);
    }
  },
  refreshHeartbeat: async (userId: string, socketId: string) => {
    await redis.set(`socket:hb:${socketId}`, userId, "EX", 90);
  },
  isUserOnline: async (userId: string) => {
    const sockets = await redis.smembers(`presence:${userId}`);
    if (sockets.length === 0) return false;

    // Verify which sockets are truly alive
    const pipeline = redis.pipeline();
    sockets.forEach(sid => pipeline.exists(`socket:hb:${sid}`));
    const results = await pipeline.exec();

    let aliveCount = 0;
    const toRemove: string[] = [];

    results?.forEach(([err, exists], index) => {
      if (!err && exists === 1) {
        aliveCount++;
      } else {
        toRemove.push(sockets[index]);
      }
    });

    if (toRemove.length > 0) {
      logger.debug(`[Presence] Purging ${toRemove.length} stale sockets for user ${userId}`, { userId });
      await redis.srem(`presence:${userId}`, ...toRemove);
      if (aliveCount === 0) {
        await redis.srem(`global:presence`, userId);
      }
    }

    return aliveCount > 0;
  },
  getGlobalOnlineUsers: async () => {
    const userIds = await redis.smembers(`global:presence`);
    if (userIds.length === 0) return [];
    
    // Use the optimized batch check for global list
    const onlineSet = await redisPresence.isBatchOnline(userIds);
    return Array.from(onlineSet);
  },
  isBatchOnline: async (userIds: string[]): Promise<Set<string>> => {
    if (userIds.length === 0) return new Set();
    
    // 1. Fetch all presence sets (socket lists) in one pipeline
    // This preserves the order of userIds in the results
    const socketPipeline = redis.pipeline();
    userIds.forEach(id => socketPipeline.smembers(`presence:${id}`));
    const socketResults = await socketPipeline.exec();

    const onlineUsers = new Set<string>();
    const heartbeatPipeline = redis.pipeline();
    
    // Track which users actually have sockets to verify heartbeats
    const usersWithSockets: Array<{ userId: string, sockets: string[] }> = [];

    socketResults?.forEach(([err, sockets], index) => {
      const userId = userIds[index];
      if (!err && Array.isArray(sockets) && sockets.length > 0) {
        usersWithSockets.push({ userId, sockets });
        sockets.forEach(sid => heartbeatPipeline.exists(`socket:hb:${sid}`));
      }
    });

    if (usersWithSockets.length === 0) return onlineUsers;

    // 2. Fetch all heartbeats for all discovered sockets in one pipeline
    const hbResults = await heartbeatPipeline.exec();
    if (!hbResults) return onlineUsers;

    let hbIndex = 0;
    for (const entry of usersWithSockets) {
      const { userId, sockets } = entry;
      let hasAliveSocket = false;
      const deadSockets: string[] = [];

      for (const sid of sockets) {
        const [err, exists] = hbResults[hbIndex++];
        if (!err && exists === 1) {
          hasAliveSocket = true;
        } else {
          deadSockets.push(sid);
        }
      }

      if (hasAliveSocket) {
        onlineUsers.add(userId);
      } else {
        // Self-healing: If no sockets are alive, clean up the global list
        redis.srem(`global:presence`, userId).catch(() => {});
      }
      
      // Cleanup dead socket IDs from the user's presence set
      if (deadSockets.length > 0) {
        redis.srem(`presence:${userId}`, ...deadSockets).catch(() => {});
      }
    }

    return onlineUsers;
  },
  clearPresence: async () => {
    logger.info("🧹 Cleaning up stale presence in Redis...");
    await redis.del("global:presence");
    
    // Find all presence sets and delete them
    // Use SCAN to avoid blocking Redis if there are many keys
    let cursor = "0";
    do {
      const [newCursor, keys] = await redis.scan(cursor, "MATCH", "presence:*", "COUNT", 100);
      cursor = newCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");

    // Also clear heartbeats just in case
    cursor = "0";
    do {
      const [newCursor, keys] = await redis.scan(cursor, "MATCH", "socket:hb:*", "COUNT", 100);
      cursor = newCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
    logger.info("✅ Presence cleanup complete.");
  },
  getUserSockets: async (userId: string) => {
    return await redis.smembers(`presence:${userId}`);
  }
};

/**
 * Helper to manage voice occupants in Redis
 */
export const redisVoice = {
  setOccupants: async (channelId: string, occupants: any[]) => {
    await redis.hset("voice_occupants", channelId, JSON.stringify(occupants));
  },
  getOccupants: async (channelId: string) => {
    const data = await redis.hget("voice_occupants", channelId);
    return data ? JSON.parse(data) : [];
  },
  getAllOccupants: async () => {
    const data = await redis.hgetall("voice_occupants");
    const result: Record<string, any[]> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        result[key] = JSON.parse(value);
      }
    }
    return result;
  },
  removeChannel: async (channelId: string) => {
    await redis.hdel("voice_occupants", channelId);
  },
  updateOccupants: async <T>(channelId: string, updater: (occupants: any[]) => Promise<{ occupants: any[]; result: T }>) => {
    return withRedisLock(`lock:voice:${channelId}`, 1500, async () => {
      const occupants = await redisVoice.getOccupants(channelId);
      const { occupants: nextOccupants, result } = await updater(occupants);

      if (nextOccupants.length === 0) {
        await redisVoice.removeChannel(channelId);
      } else {
        await redisVoice.setOccupants(channelId, nextOccupants);
      }

      return result;
    });
  },
  isUserInChannel: async (channelId: string, userId: string) => {
    const occupants = await redisVoice.getOccupants(channelId);
    return occupants.some((occupant: { userId?: string }) => occupant.userId === userId);
  }
};

export function sanitizeVoiceOccupants<T extends Record<string, any>>(occupants: T[]) {
  return occupants.map(({ socketId, ...occupant }) => occupant);
}

export function sanitizeVoiceOccupantsState(state: Record<string, any[]>) {
  return Object.fromEntries(
    Object.entries(state).map(([channelId, occupants]) => [channelId, sanitizeVoiceOccupants(occupants)]),
  );
}

/**
 * Helper to manage active direct calls in Redis
 */
export const redisCalls = {
  setCall: async (callId: string, details: any) => {
    await redis.set(`${DIRECT_CALL_PREFIX}${callId}`, JSON.stringify(details), "EX", DIRECT_CALL_TTL_SECONDS);
  },
  getCall: async (callId: string) => {
    const data = await redis.get(`${DIRECT_CALL_PREFIX}${callId}`);
    return data ? JSON.parse(data) : null;
  },
  getAllCalls: async () => {
    const result: Record<string, any> = {};
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${DIRECT_CALL_PREFIX}*`, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length === 0) {
        continue;
      }

      const values = await redis.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        if (typeof value === "string") {
          result[key.replace(DIRECT_CALL_PREFIX, "")] = JSON.parse(value);
        }
      });
    } while (cursor !== "0");

    return result;
  },
  removeCall: async (callId: string) => {
    await redis.del(`${DIRECT_CALL_PREFIX}${callId}`);
  },
  refreshCall: async (callId: string) => {
    const key = `${DIRECT_CALL_PREFIX}${callId}`;
    const exists = await redis.exists(key);
    if (exists) {
      await redis.expire(key, DIRECT_CALL_TTL_SECONDS);
    }
  }
};

export const redisCallTelemetry = {
  setTelemetry: async (callId: string, details: CallTelemetryAggregate) => {
    await redis.set(`${CALL_TELEMETRY_PREFIX}${callId}`, JSON.stringify(details), "EX", CALL_TELEMETRY_TTL_SECONDS);
  },
  getTelemetry: async (callId: string): Promise<CallTelemetryAggregate | null> => {
    const data = await redis.get(`${CALL_TELEMETRY_PREFIX}${callId}`);
    return data ? (JSON.parse(data) as CallTelemetryAggregate) : null;
  },
  getAllTelemetry: async (): Promise<Record<string, CallTelemetryAggregate>> => {
    const result: Record<string, CallTelemetryAggregate> = {};
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${CALL_TELEMETRY_PREFIX}*`, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length === 0) {
        continue;
      }

      const values = await redis.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        if (typeof value === "string") {
          result[key.replace(CALL_TELEMETRY_PREFIX, "")] = JSON.parse(value) as CallTelemetryAggregate;
        }
      });
    } while (cursor !== "0");

    return result;
  },
  removeTelemetry: async (callId: string) => {
    await redis.del(`${CALL_TELEMETRY_PREFIX}${callId}`);
  },
  mergeTelemetry: async (callId: string, sample: CallTelemetrySample) => {
    return withRedisLock(`lock:call_telemetry:${callId}`, 1500, async () => {
      const existingAggregate = await redisCallTelemetry.getTelemetry(callId);
      const nextAggregate = mergeTelemetryAggregate(existingAggregate, sample);
      await redisCallTelemetry.setTelemetry(callId, nextAggregate);
      return nextAggregate;
    }, { retries: 3, retryDelayMs: 20 });
  },
  refreshTelemetry: async (callId: string) => {
    const key = `${CALL_TELEMETRY_PREFIX}${callId}`;
    const exists = await redis.exists(key);
    if (exists) {
      await redis.expire(key, CALL_TELEMETRY_TTL_SECONDS);
    }
  },
};

type ClientSignal = {
  clientType?: "web" | "desktop" | string;
  appVersion?: string;
  buildId?: string;
  commit?: string;
  livekitClientVersion?: string;
  platform?: string;
  userAgent?: string;
};

export type VoiceLifecycleEvent = {
  id?: string;
  receivedAt?: string;
  event: string;
  reason?: string | null;
  severity?: "debug" | "info" | "warn" | "error";
  channelId?: string | null;
  callId?: string | null;
  voiceSessionId?: string | null;
  client?: ClientSignal | null;
  details?: Record<string, unknown> | null;
};

type StoredVoiceLifecycleEvent = Required<Pick<VoiceLifecycleEvent, "id" | "receivedAt" | "event">>
  & Omit<VoiceLifecycleEvent, "id" | "receivedAt" | "event">
  & {
    userId: string;
    username?: string | null;
    socketId?: string | null;
    rateLimited?: boolean;
  };

function safeString(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function sanitizeClientSignal(client: unknown): ClientSignal {
  const source = (client && typeof client === "object") ? client as Record<string, unknown> : {};
  return {
    clientType: safeString(source.clientType, 32),
    appVersion: safeString(source.appVersion, 32),
    buildId: safeString(source.buildId, 64),
    commit: safeString(source.commit, 64),
    livekitClientVersion: safeString(source.livekitClientVersion, 32),
    platform: safeString(source.platform, 80),
    userAgent: safeString(source.userAgent, 240),
  };
}

function sanitizeLifecycleDetails(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const result: Record<string, unknown> = {};
  Object.entries(details as Record<string, unknown>).slice(0, 16).forEach(([key, value]) => {
    const safeKey = key.slice(0, 64);
    if (typeof value === "string") {
      result[safeKey] = value.slice(0, 240);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      result[safeKey] = value;
    }
  });

  return Object.keys(result).length ? result : null;
}

function lifecycleDedupeKey(userId: string, event: VoiceLifecycleEvent, client: ClientSignal) {
  const hash = createHash("sha1")
    .update([
      userId,
      safeString(event.event, 80) || "unknown",
      safeString(event.reason, 80) || "",
      safeString(event.channelId, 80) || "",
      safeString(event.callId, 80) || "",
      safeString(event.voiceSessionId, 80) || "",
      client.clientType || "",
      client.appVersion || "",
    ].join("|"))
    .digest("hex")
    .slice(0, 24);

  return `${VOICE_LIFECYCLE_DEDUPE_PREFIX}${hash}`;
}

async function pushCappedJsonList(key: string, value: unknown, limit: number, ttlSeconds: number) {
  const serialized = JSON.stringify(value);
  const pipeline = redis.pipeline();
  pipeline.lpush(key, serialized);
  pipeline.ltrim(key, 0, limit - 1);
  pipeline.expire(key, ttlSeconds);
  await pipeline.exec();
}

async function readJsonList<T>(key: string, limit: number): Promise<T[]> {
  const values = await redis.lrange(key, 0, limit - 1);
  return values.flatMap((value) => {
    try {
      return [JSON.parse(value) as T];
    } catch {
      return [];
    }
  });
}

export const redisClientSignals = {
  record: async (userId: string, socketId: string, client: unknown, username?: string | null) => {
    const signal = {
      userId,
      username,
      socketId,
      receivedAt: new Date().toISOString(),
      client: sanitizeClientSignal(client),
    };

    await Promise.all([
      redis.set(`${CLIENT_SIGNAL_LATEST_PREFIX}${userId}`, JSON.stringify(signal), "EX", VOICE_LIFECYCLE_TTL_SECONDS),
      redis.set(`${CLIENT_SIGNAL_SOCKET_PREFIX}${socketId}`, JSON.stringify(signal), "EX", VOICE_LIFECYCLE_TTL_SECONDS),
      pushCappedJsonList(CLIENT_SIGNAL_RECENT_KEY, signal, CLIENT_SIGNAL_RECENT_LIMIT, VOICE_LIFECYCLE_TTL_SECONDS),
    ]);

    return signal;
  },
  getBySocket: async (socketId: string): Promise<ClientSignal | null> => {
    const data = await redis.get(`${CLIENT_SIGNAL_SOCKET_PREFIX}${socketId}`);
    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data) as { client?: ClientSignal };
      return parsed.client || null;
    } catch {
      return null;
    }
  },
  getRecent: async (limit = CLIENT_SIGNAL_RECENT_LIMIT) => {
    return readJsonList(CLIENT_SIGNAL_RECENT_KEY, limit);
  },
};

export const redisVoiceLifecycle = {
  record: async (
    user: { id: string; username?: string | null },
    socketId: string,
    event: VoiceLifecycleEvent,
    fallbackClient?: ClientSignal | null,
  ) => {
    const safeEvent = safeString(event.event, 80);
    if (!safeEvent) {
      return { stored: false, reason: "invalid_event" as const };
    }

    const rateKey = `${VOICE_LIFECYCLE_RATE_PREFIX}${user.id}`;
    const count = await redis.incr(rateKey);
    if (count === 1) {
      await redis.expire(rateKey, VOICE_LIFECYCLE_RATE_WINDOW_SECONDS);
    }

    if (count > VOICE_LIFECYCLE_RATE_LIMIT) {
      if (count === VOICE_LIFECYCLE_RATE_LIMIT + 1) {
        const limitedEvent: StoredVoiceLifecycleEvent = {
          id: randomUUID(),
          receivedAt: new Date().toISOString(),
          event: "voice_lifecycle_rate_limited",
          reason: "hourly_limit_exceeded",
          severity: "warn",
          channelId: safeString(event.channelId, 80) || null,
          callId: safeString(event.callId, 80) || null,
          voiceSessionId: safeString(event.voiceSessionId, 80) || null,
          client: sanitizeClientSignal(event.client || fallbackClient),
          details: { limit: VOICE_LIFECYCLE_RATE_LIMIT },
          userId: user.id,
          username: user.username || null,
          socketId,
          rateLimited: true,
        };
        await pushCappedJsonList(VOICE_LIFECYCLE_RECENT_KEY, limitedEvent, VOICE_LIFECYCLE_RECENT_LIMIT, VOICE_LIFECYCLE_TTL_SECONDS);
        await pushCappedJsonList(`${VOICE_LIFECYCLE_USER_PREFIX}${user.id}`, limitedEvent, VOICE_LIFECYCLE_USER_LIMIT, VOICE_LIFECYCLE_TTL_SECONDS);
      }

      return { stored: false, reason: "rate_limited" as const };
    }

    const client = sanitizeClientSignal(event.client || fallbackClient);
    const dedupeKey = lifecycleDedupeKey(user.id, { ...event, event: safeEvent }, client);
    const dedupeAllowed = await redis.set(dedupeKey, "1", "EX", VOICE_LIFECYCLE_DEDUPE_SECONDS, "NX");
    if (dedupeAllowed !== "OK") {
      return { stored: false, reason: "deduped" as const };
    }

    const stored: StoredVoiceLifecycleEvent = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      event: safeEvent,
      reason: safeString(event.reason, 120) || null,
      severity: event.severity || "info",
      channelId: safeString(event.channelId, 80) || null,
      callId: safeString(event.callId, 80) || null,
      voiceSessionId: safeString(event.voiceSessionId, 80) || null,
      client,
      details: sanitizeLifecycleDetails(event.details),
      userId: user.id,
      username: user.username || null,
      socketId,
    };

    await pushCappedJsonList(VOICE_LIFECYCLE_RECENT_KEY, stored, VOICE_LIFECYCLE_RECENT_LIMIT, VOICE_LIFECYCLE_TTL_SECONDS);
    await pushCappedJsonList(`${VOICE_LIFECYCLE_USER_PREFIX}${user.id}`, stored, VOICE_LIFECYCLE_USER_LIMIT, VOICE_LIFECYCLE_TTL_SECONDS);

    if (stored.severity === "warn" || stored.severity === "error") {
      logger.warn({
        message: "[VoiceLifecycle] Client event",
        event: stored.event,
        reason: stored.reason,
        userId: stored.userId,
        channelId: stored.channelId,
        callId: stored.callId,
        client: stored.client,
      });
    }

    return { stored: true, event: stored };
  },
  getRecent: async (limit = VOICE_LIFECYCLE_RECENT_LIMIT) => {
    return readJsonList<StoredVoiceLifecycleEvent>(VOICE_LIFECYCLE_RECENT_KEY, limit);
  },
  getSummary: async () => {
    const events = await redisVoiceLifecycle.getRecent(VOICE_LIFECYCLE_RECENT_LIMIT);
    const byUser: Record<string, { username?: string | null; count: number; events: Record<string, number>; reasons: Record<string, number> }> = {};
    const byEvent: Record<string, number> = {};

    for (const event of events) {
      byEvent[event.event] = (byEvent[event.event] || 0) + 1;
      const userEntry = byUser[event.userId] || { username: event.username, count: 0, events: {}, reasons: {} };
      userEntry.count += 1;
      userEntry.events[event.event] = (userEntry.events[event.event] || 0) + 1;
      if (event.reason) {
        userEntry.reasons[event.reason] = (userEntry.reasons[event.reason] || 0) + 1;
      }
      byUser[event.userId] = userEntry;
    }

    return {
      retentionSeconds: VOICE_LIFECYCLE_TTL_SECONDS,
      recentCount: events.length,
      byEvent,
      topUsers: Object.entries(byUser)
        .map(([userId, value]) => ({ userId, ...value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  },
};

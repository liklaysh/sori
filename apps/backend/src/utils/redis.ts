import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { logger } from "./logger.js";
import { mergeTelemetryAggregate, type CallTelemetryAggregate, type CallTelemetrySample } from "./callTelemetry.js";

const REDIS_URL = config.redis.url;
const DIRECT_CALL_PREFIX = "active_direct_call:";
const DIRECT_CALL_TTL_SECONDS = 3600;
const CALL_TELEMETRY_PREFIX = "call_telemetry:";
const CALL_TELEMETRY_TTL_SECONDS = 4 * 60 * 60;

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

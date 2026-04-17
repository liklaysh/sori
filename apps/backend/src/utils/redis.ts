import { Redis } from "ioredis";
import { config } from "../config.js";

const REDIS_URL = config.redis.url;

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const pubClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const subClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err: any) => console.error("[Redis] Error:", err));
redis.on("connect", () => console.log("[Redis] Connected to Valkey/Redis"));

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
      console.log(`[Presence] Purging ${toRemove.length} stale sockets for user ${userId}`);
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
    console.log("🧹 Cleaning up stale presence in Redis...");
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
    console.log("✅ Presence cleanup complete.");
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
  }
};

/**
 * Helper to manage active direct calls in Redis
 */
export const redisCalls = {
  setCall: async (callId: string, details: any) => {
    // Store as JSON to keep it simple
    await redis.hset("active_direct_calls", callId, JSON.stringify(details));
    await redis.expire("active_direct_calls", 3600); // 1 hour safety expiry
  },
  getCall: async (callId: string) => {
    const data = await redis.hget("active_direct_calls", callId);
    return data ? JSON.parse(data) : null;
  },
  removeCall: async (callId: string) => {
    await redis.hdel("active_direct_calls", callId);
  }
};

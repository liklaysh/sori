import { Context, Next } from "hono";
import { redis } from "../utils/redis.js";
import { logger } from "../utils/logger.js";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

const memoryStore = new Map<string, { count: number, resetTime: number }>();

/**
 * Generic Rate Limiter Middleware
 * Uses Valkey/Redis by default, falls back to in-memory Map
 */
export const rateLimiter = (options: RateLimitConfig) => {
  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const key = `rl:${options.keyPrefix}:${ip}`;
    
    let current: number;
    let isRedis = false;

    try {
      // 1. Try Redis
      const result = await redis.multi()
        .incr(key)
        .pexpire(key, options.windowMs)
        .exec();
      
      if (result && result[0] && typeof result[0][1] === "number") {
        current = result[0][1];
        isRedis = true;
      } else {
        throw new Error("Redis result invalid");
      }
    } catch (err) {
      // 2. Fallback to Memory
      logger.warn("RateLimiter: Falling back to memory store", { error: err as Error });
      
      const now = Date.now();
      const record = memoryStore.get(key);
      
      if (!record || now > record.resetTime) {
        current = 1;
        memoryStore.set(key, { count: 1, resetTime: now + options.windowMs });
      } else {
        record.count++;
        current = record.count;
      }
    }

    if (current > options.max) {
      logger.warn(`Rate Limit Exceeded: ${key}`, { 
        ip, 
        current, 
        max: options.max, 
        isRedis,
        path: c.req.path 
      });
      return c.json({ error: "Too many requests, please try again later." }, 429);
    }

    await next();
  };
};

// --- Preset Limiters ---

export const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased for dev testing
  keyPrefix: "auth"
});

export const uploadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyPrefix: "upload"
});

export const generalLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // Relaxed for real-time app usage
  keyPrefix: "gen"
});

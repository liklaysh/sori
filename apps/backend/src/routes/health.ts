import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { sql } from "drizzle-orm";
import { redis } from "../utils/redis.js";
import { s3Client, BUCKET_NAME } from "../utils/s3.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger.js";
import { safe } from "../utils/safe.js";

const health = new Hono();

const TIMEOUT_MS = 2000;

async function withTimeout<T>(promise: Promise<T>, name: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${name} check timeout`)), TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

health.get("/", safe(async (c) => {
  const results = {
    database: { status: "unknown", latency: 0 },
    redis: { status: "unknown", latency: 0 },
    storage: { status: "unknown", latency: 0 }
  };

  const start = Date.now();

  // 1. Check Database
  try {
    const dbStart = Date.now();
    await withTimeout(db.select({ val: sql`1` }).from(users).limit(1), "Database");
    results.database.status = "ok";
    results.database.latency = Date.now() - dbStart;
  } catch (err) {
    results.database.status = "error";
    logger.error("Healthcheck: Database failure", { error: err as Error });
  }

  // 2. Check Redis
  try {
    const redisStart = Date.now();
    const ping = await withTimeout(redis.ping(), "Redis");
    results.redis.status = ping === "PONG" ? "ok" : "error";
    results.redis.latency = Date.now() - redisStart;
  } catch (err) {
    results.redis.status = "error";
    logger.error("Healthcheck: Redis failure", { error: err as Error });
  }

  // 3. Check Storage (MinIO)
  try {
    const storageStart = Date.now();
    await withTimeout(s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME })), "Storage");
    results.storage.status = "ok";
    results.storage.latency = Date.now() - storageStart;
  } catch (err) {
    results.storage.status = "error";
    logger.error("Healthcheck: Storage failure", { error: err as Error });
  }

  const overallLatency = Date.now() - start;
  const statuses = [results.database.status, results.redis.status, results.storage.status];
  
  let overallStatus: "ok" | "degraded" | "down" = "ok";
  if (statuses.every(s => s === "error")) {
    overallStatus = "down";
  } else if (statuses.some(s => s === "error")) {
    overallStatus = "degraded";
  }

  logger.info(`Healthcheck: ${overallStatus}`, { results, overallLatency });

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: results,
    overallLatency
  }, overallStatus === "down" ? 503 : 200);
}));

export default health;

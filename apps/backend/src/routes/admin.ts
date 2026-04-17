import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { authMiddleware } from "../middleware/auth.js";
import { config } from "../config.js";
import { safe } from "../utils/safe.js";

import { db } from "../db/index.js";
import { users, serverSettings } from "../db/schema.js";
import { sql } from "drizzle-orm";
import { s3Client, BUCKET_NAME } from "../utils/s3.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

import systemRoutes from "./admin/system.js";
import usersRoutes from "./admin/users.js";
import channelsRoutes from "./admin/channels.js";
import storageRoutes from "./admin/storage.js";

const admin = new Hono();

export const isAdmin = createMiddleware(async (c, next) => {
  const jwt = (c.get("jwtPayload") || {}) as any;
  if (!jwt || jwt.role !== "adminpanel") {
    return c.json({ error: "Unauthorized" }, 403);
  }
  await next();
});

// --- 1. Public Endpoints (No auth required) ---

admin.get("/health", safe(async (c) => {
  const status = { backend: "online", database: "offline", storage: "offline", livekit: "offline" };
  try { await db.select({ val: sql`1` }).from(users).limit(1); status.database = "online"; } catch (e) { status.database = "error"; }
  try { await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME })); status.storage = "online"; } catch (e) { status.storage = "error"; }
  try { 
    const lkUrl = config.livekit.url;
    const response = await fetch(lkUrl, { method: "GET" }).catch(() => null); 
    status.livekit = response ? "online" : "error"; 
  } catch (e) { 
    status.livekit = "error"; 
  }
  return c.json(status);
}));

admin.get("/public/settings", safe(async (c) => {
  const settings = await db.select().from(serverSettings);
  const result: Record<string, string> = {};
  const whitelist = ["ServerName", "server_name", "public_registration"];
  settings.forEach(s => { if (whitelist.includes(s.key)) result[s.key] = s.value; });
  return c.json(result);
}));

// 2. Apply Middleware for all remaining routes
admin.use("*", authMiddleware, isAdmin);

// 3. Mount Protected sub-routers
admin.route("/", systemRoutes); // /stats, /settings
admin.route("/users", usersRoutes);
admin.route("/channels", channelsRoutes);
admin.route("/", storageRoutes); // /audit_logs, /backup

export default admin;

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import bcrypt from "bcryptjs";
import { config, validateConfig } from "./config.js";
import { logger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { db } from "./db/index.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    jwtPayload: {
      id: string;
      username: string;
      role: string;
      [key: string]: any;
    };
  }
}
import { communities, categories, channels, users } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { ensureBucket } from "./utils/s3.js";

// Routes
import authRoutes from "./routes/auth.js";
import communityRoutes from "./routes/communities.js";
import channelRoutes from "./routes/channels.js";
import callRoutes from "./routes/calls.js";
import dmRoutes from "./routes/dm.js";
import uploadRoutes from "./routes/upload.js";
import userRoutes from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import timeRoutes from "./routes/time.js";
import utilsRoutes from "./routes/utils.js";
import healthRoutes from "./routes/health.js";
import { authLimiter, uploadLimiter, generalLimiter } from "./middleware/rateLimiter.js";

// Sockets
import { initSocket } from "./socket.js";
import { redisPresence } from "./utils/redis.js";

const app = new Hono();

// Global Fallbacks
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ 
    message: "Unhandled Rejection", 
    reason, 
    fatal: config.security.isProduction 
  }, { error: reason as Error });
  
  if (config.security.isProduction) {
    setTimeout(() => process.exit(1), 200);
  }
});

process.on("uncaughtException", (err) => {
  logger.error({ 
    message: "Uncaught Exception", 
    fatal: config.security.isProduction 
  }, { error: err });
  
  if (config.security.isProduction) {
    setTimeout(() => process.exit(1), 200);
  }
});

// Validate configuration early
validateConfig();

app.use("*", requestIdMiddleware);

// Structured Request Logger Middleware
app.use("*", async (c, next) => {
  const isHealthCheck = c.req.path.startsWith("/health");
  
  // Completely skip logging for health checks
  if (isHealthCheck) {
    return await next();
  }

  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  
  // Sampling logic
  const sampleRate = config.logging.sampleRate;
  const shouldLog = Math.random() < sampleRate;
  
  // High priority logs (slow requests or errors) should ALWAYS be logged regardless of sampling
  const isHighPriority = duration > 1000 || c.res.status >= 400;

  if (shouldLog || isHighPriority) {
    const requestId = c.get("requestId");
    const user = c.get("jwtPayload");
    
    const logPayload = {
      message: `HTTP ${c.req.method} ${c.req.path}`,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      requestId,
      userId: user?.id
    };

    if (duration > 1000) {
      logger.warn(`Slow Request: ${c.req.path}`, logPayload);
    } else {
      logger.info(logPayload);
    }
  }
});

app.onError((err, c) => {
  const requestId = c.get("requestId");
  const user = c.get("jwtPayload");

  logger.error({
    message: `Hono Error: ${err.message}`,
    requestId,
    userId: user?.id,
    path: c.req.path,
    method: c.req.method
  }, { error: err });

  // Webhook Alert for critical/unexpected errors
  if (config.security.isProduction && config.alerts?.webhookUrl) {
    fetch(config.alerts.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert: "Critical Hono Error",
        message: err.message,
        requestId,
        path: c.req.path,
        timestamp: new Date().toISOString()
      })
    }).catch(e => logger.error("Failed to send alert webhook", { error: e as Error }));
  }

  return c.json({
    error: "Internal Server Error",
    message: config.security.isProduction ? "An unexpected error occurred" : err.message,
    requestId
  }, 500);
});

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return "*"; // Handle non-browser requests
    const allowed = config.cors.allowedOrigins;
    if (allowed.includes(origin) || origin.endsWith("sori.orb.local") || origin.includes("localhost")) {
      return origin;
    }
    return allowed[0] || "https://sori-web.sori.orb.local";
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Health check
app.route("/health", healthRoutes);
app.get("/", (c) => c.json({ status: "online", service: "Sori API" }));

// Mount Routes
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/me", generalLimiter);
app.use("/auth/refresh", generalLimiter);
app.use("/upload", uploadLimiter);

app.route("/auth", authRoutes);
app.route("/communities", communityRoutes);
app.route("/channels", channelRoutes);
app.route("/calls", callRoutes);
app.route("/dm", dmRoutes);
app.route("/upload", uploadRoutes);
app.route("/users", userRoutes);
app.route("/admin", adminRoutes);
app.route("/time", timeRoutes);
app.route("/utils", utilsRoutes);

const port = config.port;

async function startServer() {
  // 1. DB Check
  try {
    const dbCheck = await db.query.communities.findFirst();
    logger.info("📡 [Lifecycle] DB connected");
  } catch (err) {
    logger.error("❌ [Lifecycle] DB connection failed", { error: err as Error });
    if (config.security.isProduction) process.exit(1);
  }

  // 2. Valkey Check
  try {
    const pong = await redisPresence.clearPresence(); // clearPresence uses redis.del
    logger.info("📡 [Lifecycle] Valkey connected");
  } catch (err) {
    logger.error("❌ [Lifecycle] Valkey connection failed", { error: err as Error });
  }

  // 3. MinIO Check
  try {
    await ensureBucket();
    logger.info("📡 [Lifecycle] MinIO ready");
  } catch (err) {
    logger.error("❌ [Lifecycle] MinIO setup failed", { error: err as Error });
  }

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
  }, (info) => {
    logger.info(`🚀 [Lifecycle] Server started on http://${info.address}:${info.port}`);
  });

  // 4. Socket.io Init
  try {
    initSocket(server);
    logger.info("📡 [Lifecycle] Socket.io ready");
  } catch (err) {
    logger.error("❌ [Lifecycle] Socket.io init failed", { error: err as Error });
  }

  // 5. LiveKit Ready Log
  if (config.livekit.url) {
    logger.info("📡 [Lifecycle] LiveKit ready", { url: config.livekit.url });
  }

  // Run Seeding
  seed().catch(err => logger.error("🌱 Seeding error", { error: err }));
}

startServer();
// --- Database Seeding ---
async function seed() {
  const defaultCommunityId = "default-community";
  const existing = await db.query.communities.findFirst({ where: eq(communities.id, defaultCommunityId) });

  if (!existing) {
    logger.info("🌱 Seeding default structure...");
    await db.insert(communities).values({ id: defaultCommunityId, name: "Sori Sanctuary" });
    
    const textCatId = "cat-text";
    const voiceCatId = "cat-voice";
    await db.insert(categories).values([
      { id: textCatId, name: "Text Channels", communityId: defaultCommunityId, order: 0 },
      { id: voiceCatId, name: "Voice Channels", communityId: defaultCommunityId, order: 1 }
    ]);

    await db.insert(channels).values([
      { id: "main", name: "main", type: "text", communityId: defaultCommunityId, categoryId: textCatId, order: 0 },
      { id: "main-voice", name: "main_voice", type: "voice", communityId: defaultCommunityId, categoryId: voiceCatId, order: 0 }
    ]);

    // Create Adminpanel user
    const adminId = "admin-panel-user";
    const passwordHash = await bcrypt.hash("adminpassword123", 10);
    await db.insert(users).values({
      id: adminId,
      username: "sori-admin",
      email: "admin@sori.io",
      passwordHash,
      role: "adminpanel"
    }).onConflictDoNothing();

    logger.info("✅ Seeding complete. Admin user: admin@sori.io / adminpassword123");
  }
}

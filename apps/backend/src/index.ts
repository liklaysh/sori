import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
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
import { ensureDefaultStructure } from "./bootstrap/defaultSetup.js";
import { ensureBucket } from "./utils/s3.js";
import { cleanupCallTelemetry } from "./utils/callMaintenance.js";
import { runDbMigrations } from "./db/migrations.js";

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
import clientRoutes from "./routes/client.js";
import { authLimiter, uploadLimiter, generalLimiter } from "./middleware/rateLimiter.js";
import { csrfMiddleware, originCheckMiddleware } from "./middleware/security.js";

// Sockets
import { initSocket } from "./socket.js";
import { redis } from "./utils/redis.js";

const app = new Hono();

function isAllowedCorsOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const allowed = new Set(config.cors.allowedOrigins);

    return allowed.has(origin)
      || hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "sori.orb.local"
      || hostname.endsWith(".sori.orb.local");
  } catch {
    return false;
  }
}

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
  const status = typeof (err as any)?.status === "number" ? (err as any).status : 500;

  logger.error({
    message: `Hono Error: ${err.message}`,
    requestId,
    userId: user?.id,
    path: c.req.path,
    method: c.req.method
	  }, { error: err });

  if (status < 500) {
    return c.json({
      error: err.message || "Request failed",
      requestId,
    }, status as any);
  }

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
    const fallbackOrigin = config.cors.allowedOrigins[0] || "https://sori-web.sori.orb.local";
    if (!origin) {
      return fallbackOrigin;
    }

    if (isAllowedCorsOrigin(origin)) {
      return origin;
    }

    return fallbackOrigin;
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-ID",
    "x-request-id",
  ],
}));

app.use("*", originCheckMiddleware);
app.use("*", csrfMiddleware);

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
app.route("/client", clientRoutes);
app.route("/", clientRoutes);

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

  try {
    await runDbMigrations();
    logger.info("📡 [Lifecycle] Database migrations complete");
  } catch (err) {
    logger.error("❌ [Lifecycle] Database migrations failed", { error: err as Error });
    if (config.security.isProduction) process.exit(1);
  }

  // 2. Valkey Check
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error(`Unexpected Valkey response: ${pong}`);
    }
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

  cleanupCallTelemetry().catch((err) => {
    logger.warn("[Lifecycle] Initial call telemetry cleanup failed", { error: err as Error });
  });

  setInterval(() => {
    cleanupCallTelemetry().catch((err) => {
      logger.warn("[Lifecycle] Scheduled call telemetry cleanup failed", { error: err as Error });
    });
  }, 30 * 60 * 1000);
}

startServer();
async function seed() {
  await ensureDefaultStructure();
}

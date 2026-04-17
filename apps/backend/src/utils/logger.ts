import { config } from "../config.js";
import { globalIo } from "../globals.js";

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

interface LogPayload {
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  socketId?: string;
  service: string;
  timestamp: string;
  stack?: string;
  duration?: number;
  [key: string]: any;
}

const serviceName = "backend";

function log(level: LogLevel, data: string | any, meta?: any) {
  const currentConfigLevel = (config.logging.level as LogLevel) || "info";
  if (LEVEL_PRIORITY[level] > LEVEL_PRIORITY[currentConfigLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  
  let payload: LogPayload;
  if (typeof data === "string") {
    payload = {
      level,
      message: data,
      service: serviceName,
      timestamp,
      ...meta
    };
  } else {
    payload = {
      level,
      message: (data as any).message || "No message provided",
      service: serviceName,
      timestamp,
      ...data,
      ...meta
    };
  }

  // Handle Error objects specifically (checking multiple places)
  const errorObj = meta?.error || (data as any)?.error || (data instanceof Error ? data : null);
  if (errorObj instanceof Error) {
    payload.stack = errorObj.stack;
    if (payload.message === "No message provided" || payload.message === "[object Object]") {
      payload.message = errorObj.message;
    }
  }

  // Output JSON to console (stdout)
  process.stdout.write(JSON.stringify(payload) + "\n");

  // Broadcast to admin room
  if (globalIo && LEVEL_PRIORITY[level] <= LEVEL_PRIORITY.info) {
    globalIo.to("admin_logs").emit("server_log", {
      level,
      message: payload.message,
      requestId: payload.requestId,
      timestamp: payload.timestamp
    });
  }
}

export const logger = {
  fatal: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("fatal", data, meta),
  error: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("error", data, meta),
  warn: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("warn", data, meta),
  info: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("info", data, meta),
  debug: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("debug", data, meta)
};

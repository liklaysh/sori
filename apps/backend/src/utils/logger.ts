import { config } from "../config.js";
import { globalIo } from "../globals.js";

type LogLevel = "info" | "warn" | "error" | "debug";

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
  fatal?: boolean;
  [key: string]: any;
}

const serviceName = "backend";

function log(level: LogLevel, data: string | any, meta?: any) {
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

  // Output JSON to console
  console.log(JSON.stringify(payload));

  // Broadcast to admin room
  if (globalIo && level !== "debug") {
    globalIo.to("admin_logs").emit("server_log", {
      level: level === ("debug" as string) ? "info" : level,
      message: payload.message,
      requestId: payload.requestId,
      timestamp: payload.timestamp
    });
  }
}

export const logger = {
  info: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("info", data, meta),
  warn: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("warn", data, meta),
  error: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => log("error", data, meta),
  debug: (data: string | Partial<LogPayload>, meta?: Partial<LogPayload>) => {
    if (!config.security.isProduction) {
      log("debug", data, meta);
    }
  }
};

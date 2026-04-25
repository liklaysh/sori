import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { config } from "../config.js";
import { JWT_SECRET } from "./auth.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/csrf",
]);

function normalizeOrigin(value: string | undefined | null) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isAllowedSoriOrigin(origin: string) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const allowed = new Set([
      ...config.cors.allowedOrigins.map(normalizeOrigin),
      normalizeOrigin(config.public.webUrl),
      normalizeOrigin(config.public.apiUrl),
    ].filter(Boolean));

    return allowed.has(normalized)
      || hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "sori.orb.local"
      || hostname.endsWith(".sori.orb.local");
  } catch {
    return false;
  }
}

export const originCheckMiddleware = createMiddleware(async (c, next) => {
  if (!UNSAFE_METHODS.has(c.req.method)) {
    return next();
  }

  const origin = c.req.header("origin");
  if (!origin) {
    return next();
  }

  if (!isAllowedSoriOrigin(origin)) {
    return c.json({ error: "Origin is not allowed" }, 403);
  }

  await next();
});

export const csrfMiddleware = createMiddleware(async (c, next) => {
  if (!UNSAFE_METHODS.has(c.req.method) || CSRF_EXEMPT_PATHS.has(c.req.path)) {
    return next();
  }

  // Non-browser clients generally do not send Origin. Origin check is the primary
  // browser boundary; CSRF token enforcement is applied to browser-origin writes.
  if (!c.req.header("origin")) {
    return next();
  }

  const authToken = getCookie(c, "sori_auth");
  if (!authToken) {
    return next();
  }

  const requestToken = c.req.header("x-csrf-token");
  if (!requestToken) {
    return c.json({ error: "Missing CSRF token" }, 403);
  }

  try {
    const payload = await verify(authToken, JWT_SECRET, "HS256") as { csrfToken?: unknown };
    if (typeof payload.csrfToken !== "string" || payload.csrfToken !== requestToken) {
      return c.json({ error: "Invalid CSRF token" }, 403);
    }
  } catch {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  await next();
});

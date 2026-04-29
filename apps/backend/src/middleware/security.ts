import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { JWT_SECRET } from "./auth.js";
import { isAllowedSoriOrigin } from "../utils/origin.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/csrf",
]);

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

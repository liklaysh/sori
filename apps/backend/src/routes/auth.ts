import { Hono } from "hono";
import { verify } from "hono/jwt";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { users, members } from "../db/schema.js";
import { eq, like, or, and, not, sql } from "drizzle-orm";
import { JWT_SECRET, authMiddleware } from "../middleware/auth.js";
import { normalizeS3Url } from "../utils/url.js";
import { loginSchema } from "../validation/schemas.js";
import { safe } from "../utils/safe.js";
import { config } from "../config.js";
import { resolveActiveSessionUser } from "../utils/authSession.js";
import { createSessionToken } from "../utils/sessionToken.js";

const auth = new Hono();

auth.post("/register", safe(async (c) => {
  return c.json({ error: "Public registration is disabled. Please contact your system administrator for an account." }, 403);
}));

import { setCookie, deleteCookie, getCookie } from "hono/cookie";

function getOriginHost(origin: string) {
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return "";
  }
}

function getCookieOptions(c: any, maxAge: number) {
  const requestOrigin = getOriginHost(c.req.header("origin") || "");
  const publicApiOrigin = getOriginHost(config.public.apiUrl);
  const publicWebOrigin = getOriginHost(config.public.webUrl);
  const isKnownOrigin = requestOrigin === publicApiOrigin || requestOrigin === publicWebOrigin;
  const isSecureOrigin = (isKnownOrigin && requestOrigin.startsWith("https://")) || publicApiOrigin.startsWith("https://");

  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: isSecureOrigin || config.security.isProduction,
    maxAge,
  };
}

auth.post("/login", safe(async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.format() }, 400);
  }
  
  const { email, password } = result.data;
  const user = await db.query.users.findFirst({ 
    where: or(eq(users.email, email), eq(users.username, email)) 
  });
  
  if (!user || !(await bcrypt.compare(password, user.passwordHash)) || user.role === 'deleted') {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (user.role !== 'adminpanel') {
    await db.insert(members).values({ userId: user.id, communityId: "default-community", role: "member" })
      .onConflictDoNothing();
  }

  const expTime = user.role === 'adminpanel' 
    ? Math.floor(Date.now() / 1000) + (12 * 60 * 60) 
    : Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

  const maxAge = user.role === 'adminpanel' ? 12 * 60 * 60 : 7 * 24 * 60 * 60;
  const { token, csrfToken } = await createSessionToken(user, expTime);
  setCookie(c, "sori_auth", token, getCookieOptions(c, maxAge));

  return c.json({ 
    csrfToken,
    user: { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role, 
      avatarUrl: normalizeS3Url(user.avatarUrl),
      noiseSuppression: user.noiseSuppression,
      micGain: user.micGain,
      outputVolume: user.outputVolume
    } 
  });
}));

auth.get("/me", safe(async (c) => {
  const token = getCookie(c, "sori_auth");
  if (!token) {
    return c.json({ user: null });
  }

  let payload: any;
  try {
    payload = await verify(token, JWT_SECRET, "HS256");
  } catch {
    deleteCookie(c, "sori_auth", getCookieOptions(c, 0));
    return c.json({ user: null });
  }

  const sessionUser = await resolveActiveSessionUser(payload);
  if (!sessionUser) {
    deleteCookie(c, "sori_auth", getCookieOptions(c, 0));
    return c.json({ user: null });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, sessionUser.id) });
  if (!user) {
    deleteCookie(c, "sori_auth", getCookieOptions(c, 0));
    return c.json({ user: null });
  }

  let csrfToken = sessionUser.csrfToken;
  if (!csrfToken) {
    const expTime = typeof payload.exp === "number"
      ? payload.exp
      : Math.floor(Date.now() / 1000) + (user.role === "adminpanel" ? 12 * 60 * 60 : 7 * 24 * 60 * 60);
    const rotated = await createSessionToken(user, expTime);
    csrfToken = rotated.csrfToken;
    setCookie(c, "sori_auth", rotated.token, getCookieOptions(c, Math.max(expTime - Math.floor(Date.now() / 1000), 0)));
  }
  
  return c.json({ 
    csrfToken,
    user: { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role, 
      avatarUrl: normalizeS3Url(user.avatarUrl),
      noiseSuppression: user.noiseSuppression,
      micGain: user.micGain,
      outputVolume: user.outputVolume
    } 
  });
}));

auth.post("/logout", safe(async (c) => {
  deleteCookie(c, "sori_auth", getCookieOptions(c, 0));
  return c.json({ success: true });
}));

auth.get("/csrf", authMiddleware, safe(async (c) => {
  const userPayload = (c.get("jwtPayload") || {}) as any;
  if (!userPayload.csrfToken) {
    return c.json({ error: "CSRF token is missing from session" }, 401);
  }

  return c.json({ csrfToken: userPayload.csrfToken });
}));

auth.get("/refresh", authMiddleware, safe(async (c) => {
  const userPayload = (c.get("jwtPayload") || {}) as any;
  
  if (userPayload.role === 'adminpanel') {
    return c.json({ message: "Admin sessions cannot be extended" }, 400);
  }

  const expTime = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const { token, csrfToken } = await createSessionToken(userPayload, expTime, userPayload.csrfToken);
  
  const maxAge = 7 * 24 * 60 * 60;
  setCookie(c, "sori_auth", token, getCookieOptions(c, maxAge));

  return c.json({ success: true, csrfToken });
}));

export default auth;

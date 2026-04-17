import { Hono } from "hono";
import { sign } from "hono/jwt";
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

const auth = new Hono();

auth.post("/register", safe(async (c) => {
  return c.json({ error: "Public registration is disabled. Please contact your system administrator for an account." }, 403);
}));

import { setCookie, deleteCookie } from "hono/cookie";

/**
 * Dynamically determine cookie options based on the request origin.
 */
function getCookieOptions(c: any, maxAge: number) {
  const origin = c.req.header("origin") || "";
  const isCrossDomain = origin.includes("sori.orb.local") || (origin && !origin.includes("localhost:3000"));
  
  return {
    path: "/",
    httpOnly: true,
    // SameSite: None requires Secure=true. For .orb.local (HTTPS) we must use None/Secure.
    sameSite: isCrossDomain ? "None" as const : "Lax" as const,
    secure: isCrossDomain || config.security.isProduction,
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

  const payload = { 
    id: user.id, 
    username: user.username,
    role: user.role,
    exp: expTime 
  };

  const token = await sign(payload, JWT_SECRET);

  const maxAge = user.role === 'adminpanel' ? 12 * 60 * 60 : 7 * 24 * 60 * 60;
  setCookie(c, "sori_auth", token, getCookieOptions(c, maxAge));

  return c.json({ 
    user: { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role, 
      avatarUrl: normalizeS3Url(user.avatarUrl) 
    } 
  });
}));

auth.get("/me", authMiddleware, safe(async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const user = await db.query.users.findFirst({ where: eq(users.id, payload.id) });
  if (!user) return c.json({ error: "User not found" }, 404);
  
  return c.json({ 
    user: { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role, 
      avatarUrl: normalizeS3Url(user.avatarUrl)
    } 
  });
}));

auth.post("/logout", safe(async (c) => {
  deleteCookie(c, "sori_auth");
  return c.json({ success: true });
}));

auth.get("/refresh", authMiddleware, safe(async (c) => {
  const userPayload = (c.get("jwtPayload") || {}) as any;
  
  if (userPayload.role === 'adminpanel') {
    return c.json({ message: "Admin sessions cannot be extended" }, 400);
  }

  const expTime = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const payload = { ...userPayload, exp: expTime };
  const token = await sign(payload, JWT_SECRET);
  
  const maxAge = 7 * 24 * 60 * 60;
  setCookie(c, "sori_auth", token, getCookieOptions(c, maxAge));

  return c.json({ success: true });
}));

// Search users via DB
auth.get("/users/search", authMiddleware, safe(async (c) => {
  const query = c.req.query("q");
  const searchPattern = query ? `%${query.toLowerCase()}%` : null;
  
  const results = await db.query.users.findMany({
    where: and(
      searchPattern ? or(
        like(sql`lower(${users.username})`, searchPattern),
        like(sql`lower(${users.email})`, searchPattern)
      ) : undefined,
      not(eq(users.role, 'adminpanel')) // Hide adminpanel role from search
    ),
    orderBy: sql`${users.createdAt} DESC`,
    limit: 20
  });
  
  return c.json(results.map(u => ({ 
    id: u.id, 
    username: u.username, 
    avatarUrl: normalizeS3Url(u.avatarUrl),
    status: u.status 
  })));
}));

export default auth;

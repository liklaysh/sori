import { jwt } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import { config } from "../config.js";

export const JWT_SECRET = config.jwt.secret;

export const authMiddleware = jwt({
  secret: JWT_SECRET,
  alg: "HS256",
  cookie: "sori_auth", // Extract JWT from this cookie
});

export const isUser = createMiddleware(async (c, next) => {
  const payload = c.get("jwtPayload") as { id: string; role: string };
  if (payload && payload.role === "adminpanel") {
    return c.json({ error: "Admins cannot access chat features. Use Admin Panel only." }, 403);
  }
  await next();
});

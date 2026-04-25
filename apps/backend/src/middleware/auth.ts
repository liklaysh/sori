import { jwt } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import { config } from "../config.js";
import { resolveActiveSessionUser } from "../utils/authSession.js";

export const JWT_SECRET = config.jwt.secret;

const jwtMiddleware = jwt({
  secret: JWT_SECRET,
  alg: "HS256",
  cookie: "sori_auth", // Extract JWT from this cookie
});

export const authMiddleware = createMiddleware(async (c, next) => {
  const response = await jwtMiddleware(c, async () => {});
  if (response) {
    return response;
  }

  const sessionUser = await resolveActiveSessionUser(c.get("jwtPayload"));
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("jwtPayload", sessionUser);
  await next();
});

export const isUser = createMiddleware(async (c, next) => {
  const payload = c.get("jwtPayload") as { id: string; role: string };
  if (payload && payload.role === "adminpanel") {
    return c.json({ error: "Admins cannot access chat features. Use Admin Panel only." }, 403);
  }
  await next();
});

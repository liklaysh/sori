import { randomBytes } from "node:crypto";
import { sign } from "hono/jwt";
import { JWT_SECRET } from "../middleware/auth.js";

export interface SessionTokenUser {
  id: string;
  username: string;
  role: string;
}

export function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSessionToken(
  user: SessionTokenUser,
  expiresAtSeconds: number,
  csrfToken = createCsrfToken(),
) {
  return {
    csrfToken,
    token: await sign({
      id: user.id,
      username: user.username,
      role: user.role,
      csrfToken,
      exp: expiresAtSeconds,
    }, JWT_SECRET),
  };
}

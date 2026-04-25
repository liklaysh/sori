import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export type AuthPayload = {
  id?: string;
  username?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
};

export type ActiveSessionUser = {
  id: string;
  username: string;
  role: string;
  exp?: number;
  csrfToken?: string;
};

export async function resolveActiveSessionUser(payload: AuthPayload | null | undefined): Promise<ActiveSessionUser | null> {
  if (!payload?.id) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.id),
    columns: {
      id: true,
      username: true,
      role: true,
    },
  });

  if (!user || user.role === "deleted") {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
    csrfToken: typeof payload.csrfToken === "string" ? payload.csrfToken : undefined,
  };
}

import { Hono } from "hono";
import { db } from "../../db/index.js";
import { users, members, callParticipants } from "../../db/schema.js";
import { desc, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { logAudit } from "../../utils/audit.js";
import { logger } from "../../utils/logger.js";
import { normalizeS3Url } from "../../utils/url.js";

const usersAdmin = new Hono();

function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let pass = "";
  for(let i=0; i<16; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

usersAdmin.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt,
  }).from(users)
    .where(ne(users.role, "deleted"))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const normalizedUsers = allUsers.map(u => ({
    ...u,
    avatarUrl: normalizeS3Url(u.avatarUrl)
  }));
    
  return c.json(normalizedUsers);
});

usersAdmin.post("/", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const { email } = await c.req.json() as { email: string };
  if (!email) return c.json({ error: "Email is required" }, 400);

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return c.json({ error: "User exists" }, 400);

  const rawPassword = generatePassword();
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const id = nanoid();
  const username = email.split('@')[0];

  await db.insert(users).values({ id, email, username, passwordHash, role: "user" });

  await logAudit(payload.id || "system", "created_user", email);
  return c.json({ success: true, user: { id, email }, temporaryPassword: rawPassword });
});

usersAdmin.delete("/:id", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const userId = c.req.param("id");
  if (userId === payload.id) return c.json({ error: "Cannot delete yourself" }, 400);

  try {
    await db.update(users)
      .set({
        username: "Deleted User",
        email: `deleted_${userId}_${Date.now()}@sori.local`,
        passwordHash: "DISABLED_ACCOUNT_" + nanoid(),
        avatarUrl: null,
        role: "deleted",
        status: "offline"
      })
      .where(eq(users.id, userId));

    await db.delete(members).where(eq(members.userId, userId));
    await db.delete(callParticipants).where(eq(callParticipants.userId, userId));

    await logAudit(payload.id || "system", "soft_deleted_user", userId);
    return c.json({ success: true, message: "User anonymized and access revoked." });
  } catch (err: any) {
    logger.error("User soft-deletion failed:", err);
    return c.json({ error: `Failed to process user deletion: ${err.message}` }, 500);
  }
});

usersAdmin.post("/:id/reset_pwd", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const userId = c.req.param("id");
  
  const rawPassword = generatePassword();
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  await logAudit(payload.id || "system", "reset_user_password", userId);
  return c.json({ success: true, temporaryPassword: rawPassword });
});

export default usersAdmin;

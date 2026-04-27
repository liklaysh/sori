import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { config } from "../config.js";
import { ensureDefaultStructure, ensureServerSettings } from "../bootstrap/defaultSetup.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required install env: ${key}`);
  }
  return value;
}

async function ensureAdminPanelUser() {
  const login = requiredEnv("ADMIN_PANEL_LOGIN");
  const password = requiredEnv("ADMIN_PANEL_PASSWORD");
  const installDomain = requiredEnv("INSTALL_DOMAIN");
  const email = (process.env.ADMIN_PANEL_EMAIL?.trim() || `${login}@${installDomain}`).toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  const conflictingUser = await db.query.users.findFirst({
    where: or(eq(users.username, login), eq(users.email, email)),
  });

  if (conflictingUser && conflictingUser.role !== "adminpanel") {
    throw new Error(`Cannot bootstrap adminpanel user because "${login}" or "${email}" is already used by a regular account.`);
  }

  const existingAdmin = conflictingUser?.role === "adminpanel"
    ? conflictingUser
    : await db.query.users.findFirst({
      where: eq(users.role, "adminpanel"),
    });

  if (existingAdmin) {
    await db.update(users)
      .set({
        username: login,
        email,
        passwordHash,
        role: "adminpanel",
      })
      .where(eq(users.id, existingAdmin.id));
    return { id: existingAdmin.id, username: login, email };
  }

  const adminId = "admin-panel-user";

  await db.insert(users).values({
    id: adminId,
    username: login,
    email,
    passwordHash,
    role: "adminpanel",
  });

  return { id: adminId, username: login, email };
}

async function main() {
  await ensureDefaultStructure();
  await ensureServerSettings(process.env.SORI_SERVER_NAME || process.env.INSTALL_DOMAIN || "Sori Server");

  const admin = await ensureAdminPanelUser();

  process.stdout.write(JSON.stringify({
    ok: true,
    installMode: "single-community",
    defaultCommunityId: config.public.defaultCommunityId,
    admin,
    requestId: nanoid(),
  }, null, 2));
  process.stdout.write("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[bootstrapInstall] failed", error);
    process.exit(1);
  });

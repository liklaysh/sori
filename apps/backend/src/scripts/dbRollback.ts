import fs from "node:fs";
import path from "node:path";
import { migrationClient } from "../db/index.js";
import { logger } from "../utils/logger.js";

const MIGRATIONS_FOLDER = fs.existsSync(path.resolve(process.cwd(), "drizzle"))
  ? path.resolve(process.cwd(), "drizzle")
  : path.resolve(process.cwd(), "apps/backend/drizzle");
const ROLLBACKS_FOLDER = path.join(MIGRATIONS_FOLDER, "rollbacks");

async function getLatestMigration() {
  const rows = await migrationClient`
    SELECT id, hash, created_at
    FROM "drizzle"."__drizzle_migrations"
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return rows[0] as { id: number; hash: string; created_at: number } | undefined;
}

async function getMigrationTagByCreatedAt(createdAt: number) {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")) as {
    entries: Array<{ tag: string; when: number }>;
  };

  return journal.entries.find((entry) => Number(entry.when) === Number(createdAt))?.tag;
}

async function rollbackLatestMigration() {
  const latestMigration = await getLatestMigration();
  if (!latestMigration) {
    logger.info("[db:rollback] no recorded migrations");
    return;
  }

  const tag = await getMigrationTagByCreatedAt(latestMigration.created_at);
  if (!tag) {
    throw new Error(`Could not resolve migration tag for created_at=${latestMigration.created_at}`);
  }

  const rollbackPath = path.join(ROLLBACKS_FOLDER, `${tag}.down.sql`);
  if (!fs.existsSync(rollbackPath)) {
    throw new Error(`No rollback SQL found for migration ${tag}`);
  }

  const statements = fs.readFileSync(rollbackPath, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await migrationClient.begin(async (sql) => {
    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    await sql`
      DELETE FROM "drizzle"."__drizzle_migrations"
      WHERE id = ${latestMigration.id}
    `;
  });

  logger.info("[db:rollback] rolled back latest migration", { tag });
}

rollbackLatestMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("[db:rollback] failed", { error });
    process.exit(1);
  });

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, migrationClient } from "./index.js";
import { logger } from "../utils/logger.js";

const MIGRATIONS_FOLDER = fs.existsSync(path.resolve(process.cwd(), "drizzle"))
  ? path.resolve(process.cwd(), "drizzle")
  : path.resolve(process.cwd(), "apps/backend/drizzle");
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";
const INITIAL_MIGRATION_TAG = "0000_initial_schema";
const INITIAL_MIGRATION_MILLIS = 1777123527911;

function readMigrationHash(tag: string) {
  const migrationSql = fs.readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");
  return crypto.createHash("sha256").update(migrationSql).digest("hex");
}

async function tableExists(tableName: string) {
  const rows = await migrationClient`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;

  return rows[0]?.exists === true;
}

async function hasRecordedMigrations() {
  const rows = await migrationClient`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ${MIGRATIONS_SCHEMA}
        AND table_name = ${MIGRATIONS_TABLE}
    ) AS "exists"
  `;

  if (rows[0]?.exists !== true) {
    return false;
  }

  const countRows = await migrationClient`
    SELECT count(*)::int AS count
    FROM "drizzle"."__drizzle_migrations"
  `;

  return Number(countRows[0]?.count || 0) > 0;
}

async function baselineExistingDatabaseIfNeeded() {
  if (await hasRecordedMigrations()) {
    return;
  }

  const usersTableExists = await tableExists("users");
  if (!usersTableExists) {
    return;
  }

  await migrationClient`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
  await migrationClient`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  await migrationClient`
    INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
    VALUES (${readMigrationHash(INITIAL_MIGRATION_TAG)}, ${INITIAL_MIGRATION_MILLIS})
  `;

  logger.info("[Migrations] Existing database baselined for Drizzle migrations", {
    migration: INITIAL_MIGRATION_TAG,
  });
}

export async function runDbMigrations() {
  await baselineExistingDatabaseIfNeeded();
  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsSchema: MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
  });
}

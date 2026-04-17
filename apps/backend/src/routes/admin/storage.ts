import { Hono } from "hono";
import { db } from "../../db/index.js";
import { auditLogs } from "../../db/schema.js";
import { desc, lt } from "drizzle-orm";
import { logAudit } from "../../utils/audit.js";
import { logger } from "../../utils/logger.js";
import fs from "fs";
import path from "path";
import { getStorageStats, listRecentFiles, deleteFile } from "../../utils/s3.js";

import { config } from "../../config.js";

// PostgreSQL is used now, SQLite backup logic is deprecated
const storageAdmin = new Hono();

// --- Audit Logs ---
storageAdmin.get("/audit_logs", async (c) => {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  return c.json(logs);
});

storageAdmin.post("/audit_logs/cleanup", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const retentionDays = config.storage?.logRetentionDays || 3;
  
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - retentionDays);
  
  await db.delete(auditLogs).where(lt(auditLogs.timestamp, threshold));
  await logAudit(payload.id || "system", "cleaned_audit_logs", `Older than ${retentionDays} days`);
  
  return c.json({ success: true, retentionDays });
});

// --- Backups (PostgreSQL handled via postgres-backup service) ---
storageAdmin.get("/backup", async (c) => {
  const backupDir = "/app/backups";
  try {
    if (!fs.existsSync(backupDir)) {
      return c.json({ count: 0, backups: [], status: "active", message: "Backup repository not initialized" });
    }
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith(".sql.gz") || f.endsWith(".sql") || f.endsWith(".tar"))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return c.json({ 
      count: files.length, 
      backups: files,
      status: "active",
      retentionPolicy: "7 days"
    });
  } catch (err) {
    logger.error("Failed to list backups", { error: err as Error });
    return c.json({ error: "Failed to list backups" }, 500);
  }
});

storageAdmin.get("/backup/download/:filename", async (c) => {
  const filename = c.req.param("filename");
  const filePath = path.join("/app/backups", filename);
  
  if (!fs.existsSync(filePath)) {
    return c.json({ error: "Asset identified as missing" }, 404);
  }

  // Basic security: only .sql, .gz, .tar
  if (!filename.endsWith(".sql.gz") && !filename.endsWith(".sql") && !filename.endsWith(".tar")) {
    return c.json({ error: "Access denied: Protocol violation" }, 403);
  }

  const fileBuffer = fs.readFileSync(filePath);
  return c.body(fileBuffer, 200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
});

storageAdmin.post("/backup/restore", async (c) => {
  return c.json({ error: "Manual restore is disabled for PostgreSQL to prevent data corruption. Use the backup container tools." }, 501);
});

// --- S3 Media Storage ---
storageAdmin.get("/storage/stats", async (c) => {
  try {
    const stats = await getStorageStats();
    return c.json(stats);
  } catch (err) {
    logger.error("Failed to fetch storage stats", { error: err as Error });
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

storageAdmin.get("/storage/files", async (c) => {
  try {
    const files = await listRecentFiles();
    return c.json(files);
  } catch (err) {
    logger.error("Failed to list files", { error: err as Error });
    return c.json({ error: "Failed to list files" }, 500);
  }
});

storageAdmin.delete("/storage/files/:key", async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const key = c.req.param("key");

  if (!key) {
    return c.json({ error: "No key provided" }, 400);
  }

  try {
    await deleteFile(key);
    await logAudit(payload.id || "system", "deleted_media_file", key);
    return c.json({ success: true });
  } catch (err) {
    logger.error(`Failed to delete file ${key}`, { error: err as Error });
    return c.json({ error: "Deletion failed" }, 500);
  }
});

export default storageAdmin;

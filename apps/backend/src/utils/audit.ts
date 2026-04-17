import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import { logger } from "./logger.js";

export async function logAudit(
  adminId: string,
  action: string,
  target?: string,
  details?: Record<string, any>
) {
  try {
    await db.insert(auditLogs).values({
      adminId,
      action,
      target,
      details: details ? JSON.stringify(details) : null,
    });
    logger.info(`[Audit] ${adminId} performed ${action} on ${target || "system"}`);
  } catch (error) {
    logger.error("Failed to insert audit log", { error: error as Error });
  }
}

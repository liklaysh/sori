import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { calls } from "../db/schema.js";
import { redisCalls, redisVoice } from "./redis.js";
import { logger } from "./logger.js";

const TELEMETRY_RETENTION_HOURS = 72;
const STALE_DIRECT_CALL_HOURS = 2;

export async function cleanupCallTelemetry() {
  const seventyTwoHoursAgo = new Date(Date.now() - TELEMETRY_RETENTION_HOURS * 60 * 60 * 1000);
  const staleDirectCallThreshold = new Date(Date.now() - STALE_DIRECT_CALL_HOURS * 60 * 60 * 1000);
  const staleChannelCallThreshold = new Date(Date.now() - STALE_DIRECT_CALL_HOURS * 60 * 60 * 1000);

  try {
    await db.delete(calls).where(lt(calls.startedAt, seventyTwoHoursAgo));
  } catch (error) {
    logger.warn("[CallMaintenance] Failed to purge old call telemetry", { error: error as Error });
  }

  try {
    const staleDirectCalls = await db.query.calls.findMany({
      where: and(
        eq(calls.type, "direct"),
        eq(calls.isActive, true),
        isNull(calls.endedAt),
        lt(calls.startedAt, staleDirectCallThreshold),
      ),
    });

    for (const call of staleDirectCalls) {
      const activeCall = await redisCalls.getCall(call.id);
      if (activeCall) {
        continue;
      }

      await db.update(calls)
        .set({
          status: "ended",
          isActive: false,
          endedAt: call.startedAt || new Date(),
        })
        .where(eq(calls.id, call.id));
    }
  } catch (error) {
    logger.warn("[CallMaintenance] Failed to close stale direct calls", { error: error as Error });
  }

  try {
    const staleChannelCalls = await db.query.calls.findMany({
      where: and(
        eq(calls.type, "channel"),
        eq(calls.isActive, true),
        isNull(calls.endedAt),
        lt(calls.startedAt, staleChannelCallThreshold),
      ),
    });

    for (const call of staleChannelCalls) {
      if (!call.channelId) {
        await db.update(calls)
          .set({
            status: "ended",
            isActive: false,
            endedAt: call.startedAt || new Date(),
          })
          .where(eq(calls.id, call.id));
        continue;
      }

      const occupants = await redisVoice.getOccupants(call.channelId);
      if (occupants.length > 0) {
        continue;
      }

      await db.update(calls)
        .set({
          status: "ended",
          isActive: false,
          endedAt: call.startedAt || new Date(),
        })
        .where(eq(calls.id, call.id));
    }
  } catch (error) {
    logger.warn("[CallMaintenance] Failed to close stale channel calls", { error: error as Error });
  }
}

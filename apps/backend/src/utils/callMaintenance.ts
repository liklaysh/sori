import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { callParticipants, calls, directMessages } from "../db/schema.js";
import { redisCalls, redisVoice, redisCallTelemetry } from "./redis.js";
import { logger } from "./logger.js";

const TELEMETRY_RETENTION_HOURS = 72;
const STALE_DIRECT_CALL_HOURS = 2;

export async function cleanupCallTelemetry() {
  const seventyTwoHoursAgo = new Date(Date.now() - TELEMETRY_RETENTION_HOURS * 60 * 60 * 1000);
  const staleDirectCallThreshold = new Date(Date.now() - STALE_DIRECT_CALL_HOURS * 60 * 60 * 1000);
  const staleChannelCallThreshold = new Date(Date.now() - STALE_DIRECT_CALL_HOURS * 60 * 60 * 1000);

  try {
    const expiredCalls = await db.select({ id: calls.id })
      .from(calls)
      .where(lt(calls.startedAt, seventyTwoHoursAgo))
      .limit(500);
    const expiredCallIds = expiredCalls.map((call) => call.id);

    if (expiredCallIds.length > 0) {
      await db.delete(callParticipants).where(inArray(callParticipants.callId, expiredCallIds));
      await db.update(directMessages)
        .set({ callId: null })
        .where(inArray(directMessages.callId, expiredCallIds));
      await db.delete(calls).where(inArray(calls.id, expiredCallIds));
    }
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
      await redisCallTelemetry.removeTelemetry(call.id);
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
        await redisCallTelemetry.removeTelemetry(call.id);
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
      await redisCallTelemetry.removeTelemetry(call.id);
    }
  } catch (error) {
    logger.warn("[CallMaintenance] Failed to close stale channel calls", { error: error as Error });
  }
}

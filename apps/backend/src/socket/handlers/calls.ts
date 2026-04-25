import { Server } from "socket.io";
import { Socket } from "../../types/socket.js";
import { nanoid } from "nanoid";
import { db } from "../../db/index.js";
import { calls, dmConversations, callLogs, users } from "../../db/schema.js";
import { eq, or, and } from "drizzle-orm";
import { redisPresence, redisCalls, redisCallTelemetry, redisVoice } from "../../utils/redis.js";
import { logger } from "../../utils/logger.js";
import { normalizeS3Url } from "../../utils/url.js";
import { telemetryAggregateToCallUpdate, type CallTelemetrySample } from "../../utils/callTelemetry.js";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export function handleCalls(io: Server, socket: Socket, user: any) {
  const getCallRuntime = async (callId: string) => {
    const runtimeCall = await redisCalls.getCall(callId);
    if (runtimeCall) {
      return runtimeCall;
    }

    const dbCall = await db.query.calls.findFirst({
      where: eq(calls.id, callId),
    });

    if (!dbCall || dbCall.type !== "direct" || !dbCall.callerId || !dbCall.calleeId) {
      return null;
    }

    return {
      callerId: dbCall.callerId,
      calleeId: dbCall.calleeId,
      status: dbCall.status,
      startedAt: dbCall.startedAt?.getTime() || null,
    };
  };

  const finalizeCallAndNotify = async (callId: string, status: string, metrics?: any) => {
    const callData = await getCallRuntime(callId);
    if (!callData) {
      return;
    }

    const didClose = await endCall(callId, status, metrics);
    if (!didClose) {
      return;
    }

    if (status === "missed") {
      io.to(`user:${callData.calleeId}`).emit("call_missed", { callId });
      io.to(`user:${callData.callerId}`).emit("call_timed_out", { callId });
      return;
    }

    io.to(`user:${callData.callerId}`).emit("call_ended", { callId });
    io.to(`user:${callData.calleeId}`).emit("call_ended", { callId });
  };

  const resolveCallIdFromTelemetry = async (data: { callId?: string; channelId?: string }) => {
    if (data.callId) {
      const runtimeCall = await getCallRuntime(data.callId);
      if (!runtimeCall || (runtimeCall.callerId !== user.id && runtimeCall.calleeId !== user.id)) {
        return null;
      }

      return data.callId;
    }

    if (!data.channelId) {
      return null;
    }

    const isOccupant = await redisVoice.isUserInChannel(data.channelId, user.id);
    if (!isOccupant) {
      return null;
    }

    const activeChannelCall = await db.query.calls.findFirst({
      where: and(eq(calls.type, "channel"), eq(calls.channelId, data.channelId), eq(calls.isActive, true)),
    });

    return activeChannelCall?.id || null;
  };
  
  // Initiate a call
  socket.on("direct_call_initiate", async (data: { targetUserId: string }) => {
    try {
      const { targetUserId } = data;
      
      // Fetch latest user info for fresh avatarUrl
      const latestUser = await db.query.users.findFirst({
        where: eq(users.id, user.id)
      });
      
      // Check if user is online in Redis
      const isOnline = await redisPresence.isUserOnline(targetUserId);
      if (!isOnline) {
        return socket.emit("direct_call_error", { message: "User is offline" });
      }

      // 1. Block if CALLER is adminpanel
      if (user.role === 'adminpanel') {
        return socket.emit("direct_call_error", { message: "Administrators cannot join calls" });
      }

      // 2. Block if TARGET is adminpanel
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId)
      });
      if (!targetUser || targetUser.role === 'adminpanel') {
        return socket.emit("direct_call_error", { message: "This user cannot be called" });
      }

      const existingActiveCall = await db.query.calls.findFirst({
        where: and(
          eq(calls.type, "direct"),
          eq(calls.isActive, true),
          or(
            and(eq(calls.callerId, user.id), eq(calls.calleeId, targetUserId)),
            and(eq(calls.callerId, targetUserId), eq(calls.calleeId, user.id)),
          ),
        ),
      });

      if (existingActiveCall) {
        return socket.emit("direct_call_error", { message: "Call already in progress" });
      }

      const callId = nanoid();
      
      // Create call record
      try {
        await db.insert(calls).values({
          id: callId,
          type: "direct",
          status: "ringing",
          callerId: user.id,
          calleeId: targetUserId,
          isActive: true,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return socket.emit("direct_call_error", { message: "Call already in progress" });
        }

        throw err;
      }

      // Store in Redis
      await redisCalls.setCall(callId, {
        callerId: user.id,
        calleeId: targetUserId,
        status: "ringing",
        startedAt: Date.now(),
      });

      // Notify recipient via their dedicated user room
      io.to(`user:${targetUserId}`).emit("incoming_call", {
        callId,
        caller: {
          id: user.id,
          username: user.username,
          avatarUrl: normalizeS3Url(latestUser?.avatarUrl) || latestUser?.avatarUrl || null
        }
      });

      // Notify sender
      socket.emit("outgoing_call_started", { callId, targetUserId });

      // Set 30s timeout
      setTimeout(async () => {
        const call = await getCallRuntime(callId);
        if (call && call.status === "ringing") {
          await finalizeCallAndNotify(callId, "missed");
        }
      }, 30000);

      logger.info(`[Calls] ${user.username} initiated call to ${targetUserId}. CallID: ${callId}`);
    } catch (err) {
      logger.error("[Calls] Initiate Error:", { error: err });
      socket.emit("direct_call_error", { message: "System failure during initiation" });
    }
  });

  // Accept a call
  socket.on("direct_call_accept", async (data: { callId: string }) => {
    try {
      const { callId } = data;
      const callData = await getCallRuntime(callId);

      if (!callData) return socket.emit("direct_call_error", { message: "Call not found or expired" });
      if (callData.calleeId !== user.id) {
        return socket.emit("direct_call_error", { message: "Only the recipient can accept this call" });
      }
      if (callData.status !== "ringing") {
        return socket.emit("direct_call_error", { message: "Call is no longer ringing" });
      }

      const [acceptedCall] = await db.update(calls)
        .set({ status: "active", startedAt: new Date() })
        .where(and(eq(calls.id, callId), eq(calls.isActive, true), eq(calls.status, "ringing")))
        .returning();

      if (!acceptedCall) {
        await redisCalls.removeCall(callId);
        return socket.emit("direct_call_error", { message: "Call is no longer ringing" });
      }

      callData.status = "active";
      await redisCalls.setCall(callId, callData);

      // Notify both via their rooms
      io.to(`user:${callData.callerId}`).emit("call_accepted", { callId });
      io.to(`user:${callData.calleeId}`).emit("call_accepted", { callId });

      logger.info(`[Calls] Call ${callId} accepted by ${user.username}.`);
    } catch (err) {
      logger.error("[Calls] Accept Error:", { error: err });
      socket.emit("direct_call_error", { message: "System failure during acceptance" });
    }
  });

  // Reject a call
  socket.on("direct_call_reject", async (data: { callId: string }) => {
    try {
      const { callId } = data;
      const callData = await getCallRuntime(callId);
      if (!callData) return;
      if (callData.callerId !== user.id && callData.calleeId !== user.id) return;

      const didClose = await endCall(callId, "rejected");
      if (didClose) {
        io.to(`user:${callData.callerId}`).emit("call_rejected", { callId });
      }
    } catch (err) {
      logger.error("[Calls] Reject Error:", { error: err });
    }
  });

  // End a call
  socket.on("direct_call_end", async (data: { callId: string, metrics?: any }) => {
    try {
      const { callId, metrics } = data;
      const callData = await getCallRuntime(callId);
      if (!callData) return;
      if (callData.callerId !== user.id && callData.calleeId !== user.id) return;
      await finalizeCallAndNotify(callId, "ended", metrics);
    } catch (err) {
      logger.error("[Calls] End Error:", { error: err });
    }
  });

  socket.on(
    "call_telemetry_update",
    async (data: { callId?: string; channelId?: string } & CallTelemetrySample) => {
      try {
        const resolvedCallId = await resolveCallIdFromTelemetry(data);
        if (!resolvedCallId) {
          return;
        }

        await redisCallTelemetry.mergeTelemetry(resolvedCallId, data);
      } catch (err) {
        logger.warn("[Calls] Telemetry update failed", { error: err as Error, userId: user.id });
      }
    },
  );

  socket.on("disconnect", () => {
    setTimeout(async () => {
      try {
        const isStillOnline = await redisPresence.isUserOnline(user.id);
        if (isStillOnline) {
          return;
        }

        const activeCalls = await redisCalls.getAllCalls();
        const affectedCalls = Object.entries(activeCalls).filter(([, details]) => {
          return details?.callerId === user.id || details?.calleeId === user.id;
        });

        for (const [callId, details] of affectedCalls) {
          if (details?.status === "ringing") {
            await finalizeCallAndNotify(callId, "missed");
          } else if (details?.status === "active") {
            await finalizeCallAndNotify(callId, "ended");
          }
        }
      } catch (err) {
        logger.error("[Calls] Disconnect cleanup error:", { error: err });
      }
    }, 15000);
  });

  async function endCall(callId: string, status: string, metrics?: any): Promise<boolean> {
    try {
      logger.debug(`[Calls] >>> Starting endCall for ID: ${callId}, status: ${status}`);
      const endedAt = new Date();
      const existingCall = await db.query.calls.findFirst({
        where: eq(calls.id, callId)
      });

      if (!existingCall) {
        await redisCalls.removeCall(callId);
        await redisCallTelemetry.removeTelemetry(callId);
        return false;
      }

      if (existingCall.type !== "direct") {
        await redisCalls.removeCall(callId);
        await redisCallTelemetry.removeTelemetry(callId);
        return false;
      }

      if (!existingCall.isActive && existingCall.endedAt) {
        await redisCalls.removeCall(callId);
        await redisCallTelemetry.removeTelemetry(callId);
        return false;
      }

      const runtimeTelemetry = await redisCallTelemetry.getTelemetry(callId);
      const persistedTelemetry = telemetryAggregateToCallUpdate(runtimeTelemetry);

      // Update DB record for the call itself
      const [callData] = await db.update(calls)
        .set({ 
          status, 
          isActive: false, 
          endedAt,
          mos: persistedTelemetry.mos ?? null,
          avgBitrate: persistedTelemetry.avgBitrate ?? null,
          packetLoss: persistedTelemetry.packetLoss ?? null,
          avgJitterMs: persistedTelemetry.avgJitterMs ?? null,
          avgRttMs: persistedTelemetry.avgRttMs ?? null,
          reconnectCount: persistedTelemetry.reconnectCount ?? 0,
          telemetrySamples: persistedTelemetry.telemetrySamples ?? 0,
          connectionQuality: persistedTelemetry.connectionQuality ?? null,
        })
        .where(and(eq(calls.id, callId), eq(calls.isActive, true)))
        .returning();

      if (!callData) {
        await redisCalls.removeCall(callId);
        await redisCallTelemetry.removeTelemetry(callId);
        return false;
      }
      
      if (!callData || callData.type !== "direct") {
        logger.warn("[Calls] callData not found or not direct. Removing from Redis.", { callId });
        await redisCalls.removeCall(callId);
        await redisCallTelemetry.removeTelemetry(callId);
        return false;
      }

      const [u1, u2] = [callData.callerId!, callData.calleeId!].sort();

      // 1. Ensure DM Conversation exists
      let conversation = await db.query.dmConversations.findFirst({
        where: and(eq(dmConversations.user1Id, u1), eq(dmConversations.user2Id, u2))
      });

      if (!conversation) {
        logger.info(`[Calls] Creating new DM conversation for ${u1} & ${u2} during call log...`);
        const convId = nanoid();
        await db.insert(dmConversations).values({
          id: convId,
          user1Id: u1,
          user2Id: u2,
        }).onConflictDoNothing();
        conversation = await db.query.dmConversations.findFirst({
          where: and(eq(dmConversations.user1Id, u1), eq(dmConversations.user2Id, u2))
        });
      }

      if (conversation) {
        // 2. Prepare Call Log Entry
        const logId = nanoid();
        let duration: number | undefined = undefined;

        if (status === "ended" && callData.startedAt instanceof Date) {
          duration = Math.floor((endedAt.getTime() - callData.startedAt.getTime()) / 1000);
        }

        await db.insert(callLogs).values({
          id: logId,
          conversationId: conversation.id,
          callerId: callData.callerId!,
          calleeId: callData.calleeId!,
          status: status, // 'ended', 'missed', 'rejected', 'timeout'
          duration: duration,
          createdAt: new Date(), 
          isRead: false
        });

        const newLog = await db.query.callLogs.findFirst({
          where: eq(callLogs.id, logId)
        });

        // 3. Notify participants via socket
        const callerRoom = `user:${callData.callerId}`;
        const calleeRoom = `user:${callData.calleeId}`;
        io.to(callerRoom).emit("new_call_log", newLog);
        io.to(calleeRoom).emit("new_call_log", newLog);

        // 4. Update conversation timestamp for sorting
        await db.update(dmConversations)
          .set({ updatedAt: new Date() })
          .where(eq(dmConversations.id, conversation.id));
      } else {
        logger.error("[Calls] FAILED to resolve/create DM conversation.");
      }

      await redisCalls.removeCall(callId);
      await redisCallTelemetry.removeTelemetry(callId);
      logger.debug(`[Calls] <<< Call ${callId} finished processing.`);
      return true;
    } catch (err) {
      logger.error("[Calls] endCall Internal Error:", { error: err });
      return false;
    }
  }
}

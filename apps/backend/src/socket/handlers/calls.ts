import { Server } from "socket.io";
import { Socket } from "../../types/socket.js";
import { nanoid } from "nanoid";
import { db } from "../../db/index.js";
import { calls, directMessages, dmConversations, callLogs, users } from "../../db/schema.js";
import { eq, or, and } from "drizzle-orm";
import { redisPresence, redisCalls } from "../../utils/redis.js";
import { logger } from "../../utils/logger.js";

export function handleCalls(io: Server, socket: Socket, user: any) {
  
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

      const callId = nanoid();
      
      // Create call record
      await db.insert(calls).values({
        id: callId,
        type: "direct",
        status: "ringing",
        callerId: user.id,
        calleeId: targetUserId,
        isActive: true,
      });

      // Store in Redis
      await redisCalls.setCall(callId, {
        callerId: user.id,
        calleeId: targetUserId,
        status: "ringing"
      });

      // Notify recipient via their dedicated user room
      io.to(`user:${targetUserId}`).emit("incoming_call", {
        callId,
        caller: {
          id: user.id,
          username: user.username,
          avatarUrl: latestUser?.avatarUrl || null
        }
      });

      // Notify sender
      socket.emit("outgoing_call_started", { callId, targetUserId });

      // Set 30s timeout (Local handles the timer, but Redis stores the fact it's ringing)
      setTimeout(async () => {
        const call = await redisCalls.getCall(callId);
        if (call && call.status === "ringing") {
          await endCall(callId, "missed");
          io.to(`user:${targetUserId}`).emit("call_missed", { callId });
          io.to(`user:${user.id}`).emit("call_timed_out", { callId });
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
      const callData = await redisCalls.getCall(callId);

      if (!callData) return socket.emit("direct_call_error", { message: "Call not found or expired" });

      // Update DB
      await db.update(calls)
        .set({ status: "active", startedAt: new Date() })
        .where(eq(calls.id, callId));

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
      const callData = await redisCalls.getCall(callId);
      if (!callData) return;
      
      await endCall(callId, "rejected");
      io.to(`user:${callData.callerId}`).emit("call_rejected", { callId });
    } catch (err) {
      logger.error("[Calls] Reject Error:", { error: err });
    }
  });

  // End a call
  socket.on("direct_call_end", async (data: { callId: string, metrics?: any }) => {
    try {
      const { callId, metrics } = data;
      const callData = await redisCalls.getCall(callId);
      if (!callData) return;

      await endCall(callId, "ended", metrics);
      io.to(`user:${callData.callerId}`).emit("call_ended", { callId });
      io.to(`user:${callData.calleeId}`).emit("call_ended", { callId });
    } catch (err) {
      logger.error("[Calls] End Error:", { error: err });
    }
  });

  async function endCall(callId: string, status: string, metrics?: any) {
    try {
      logger.debug(`[Calls] >>> Starting endCall for ID: ${callId}, status: ${status}`);
      const endedAt = new Date();
      // Update DB record for the call itself
      await db.update(calls)
        .set({ 
          status, 
          isActive: false, 
          endedAt,
          mos: metrics?.mos?.toString(),
          avgBitrate: metrics?.bitrate,
          packetLoss: metrics?.packetLoss?.toString()
        })
        .where(eq(calls.id, callId));

      // Fetch call data for logging
      const callData = await db.query.calls.findFirst({
        where: eq(calls.id, callId)
      });
      
      if (!callData || callData.type !== "direct") {
        logger.warn("[Calls] callData not found or not direct. Removing from Redis.", { callId });
        await redisCalls.removeCall(callId);
        return;
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
        });
        conversation = await db.query.dmConversations.findFirst({
          where: eq(dmConversations.id, convId)
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
      logger.debug(`[Calls] <<< Call ${callId} finished processing.`);
    } catch (err) {
      logger.error("[Calls] endCall Internal Error:", { error: err });
    }
  }
}

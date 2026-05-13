import { Server, Socket } from "socket.io";
import { redisPresence, redisVoice, sanitizeVoiceOccupants } from "../../utils/redis.js";
import { db } from "../../db/index.js";
import { callParticipants, calls, channels, users } from "../../db/schema.js";
import { and, eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { normalizeS3Url } from "../../utils/url.js";
import { nanoid } from "nanoid";
import { redisCallTelemetry } from "../../utils/redis.js";
import { telemetryAggregateToCallUpdate } from "../../utils/callTelemetry.js";

const VOICE_DISCONNECT_GRACE_MS = 120_000;

type VoiceLifecycleSource =
  | "explicit_user_action"
  | "socket_reconnect"
  | "socket_disconnect_grace"
  | "heartbeat_recovery";

type VoiceOccupant = {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  socketId?: string;
  joinedAt?: number;
  heartbeatAt?: number;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isStreaming?: boolean;
};

type LeaveChannelResult = {
  changed: boolean;
  occupants: VoiceOccupant[];
  remainingUserIds: string[];
  leavingUser: {
    userId: string;
    username: string;
    avatarUrl?: string | null;
  };
  skippedReason: "not_occupant" | "stale_socket" | null;
  ownerSocketId?: string | null;
};

export function handleVoice(io: Server, socket: Socket, user: { id: string, username: string, role: string }, isAdminPanel: boolean) {
  const emitVoiceEventToUsers = (
    userIds: string[],
    event: "voice_user_joined" | "voice_user_left",
    payload: { channelId: string; userId: string; username: string; avatarUrl?: string | null },
  ) => {
    const recipients = new Set(userIds.filter((userId) => userId && userId !== payload.userId));
    recipients.forEach((userId) => {
      io.to(`user:${userId}`).emit(event, payload);
    });
  };

  const getActiveChannelCall = async (channelId: string) => {
    return db.query.calls.findFirst({
      where: and(eq(calls.type, "channel"), eq(calls.channelId, channelId), eq(calls.isActive, true)),
    });
  };

  const ensureActiveChannelCall = async (channelId: string) => {
    const existingCall = await getActiveChannelCall(channelId);
    if (existingCall) {
      return existingCall;
    }

    const id = nanoid();
    const startedAt = new Date();
    try {
      await db.insert(calls).values({
        id,
        type: "channel",
        channelId,
        status: "active",
        isActive: true,
        startedAt,
      });
    } catch (error) {
      const racedCall = await getActiveChannelCall(channelId);
      if (racedCall) {
        return racedCall;
      }

      throw error;
    }

    return db.query.calls.findFirst({
      where: eq(calls.id, id),
    });
  };

  const upsertParticipantJoin = async (channelId: string) => {
    const activeCall = await ensureActiveChannelCall(channelId);
    if (!activeCall) {
      return null;
    }

    await db.insert(callParticipants).values({
      callId: activeCall.id,
      userId: user.id,
      joinedAt: new Date(),
      leftAt: null,
    }).onConflictDoUpdate({
      target: [callParticipants.callId, callParticipants.userId],
      set: {
        joinedAt: new Date(),
        leftAt: null,
      },
    });

    return activeCall;
  };

  const finalizeChannelCall = async (channelId: string, status: string) => {
    const activeCall = await getActiveChannelCall(channelId);
    if (!activeCall) {
      return;
    }

    const aggregate = await redisCallTelemetry.getTelemetry(activeCall.id);
    await db.update(calls)
      .set({
        status,
        isActive: false,
        endedAt: new Date(),
        ...telemetryAggregateToCallUpdate(aggregate),
      })
      .where(eq(calls.id, activeCall.id));

    await redisCallTelemetry.removeTelemetry(activeCall.id);
  };

  const leaveChannel = async (
    channelId: string,
    options: { source: VoiceLifecycleSource; expectedSocketId?: string } = { source: "explicit_user_action" },
  ) => {
    if (!channelId) {
      return;
    }

    const { changed, occupants: filtered, remainingUserIds, leavingUser, skippedReason, ownerSocketId } = await redisVoice.updateOccupants<LeaveChannelResult>(channelId, async (occupants: VoiceOccupant[]) => {
      const leavingOccupant = occupants.find((occupant) => occupant.userId === user.id);

      if (!leavingOccupant) {
        return {
          occupants,
          result: {
            changed: false,
            occupants,
            remainingUserIds: occupants.map((occupant) => occupant.userId),
            leavingUser: {
              userId: user.id,
              username: user.username,
              avatarUrl: null,
            },
            skippedReason: "not_occupant",
            ownerSocketId: null,
          },
        };
      }

      if (
        options.expectedSocketId
        && leavingOccupant.socketId
        && leavingOccupant.socketId !== options.expectedSocketId
      ) {
        return {
          occupants,
          result: {
            changed: false,
            occupants,
            remainingUserIds: occupants.map((occupant) => occupant.userId),
            leavingUser: {
              userId: user.id,
              username: leavingOccupant.username || user.username,
              avatarUrl: leavingOccupant.avatarUrl || null,
            },
            skippedReason: "stale_socket",
            ownerSocketId: leavingOccupant.socketId,
          },
        };
      }

      const filteredOccupants = occupants.filter((occupant) => occupant.userId !== user.id);
      return {
        occupants: filteredOccupants,
        result: {
          changed: filteredOccupants.length !== occupants.length,
          occupants: filteredOccupants,
          remainingUserIds: filteredOccupants.map((occupant) => occupant.userId),
          leavingUser: {
            userId: user.id,
            username: leavingOccupant?.username || user.username,
            avatarUrl: leavingOccupant?.avatarUrl || null,
          },
          skippedReason: null,
          ownerSocketId: leavingOccupant.socketId || null,
        },
      };
    });

    if (!changed) {
      logger.info({
        message: "[Voice] Leave skipped",
        event: "voice_leave_skipped",
        source: options.source,
        reason: skippedReason,
        userId: user.id,
        channelId,
        socketId: socket.id,
        ownerSocketId,
      });
      return;
    }

    const activeCall = await getActiveChannelCall(channelId);
    if (activeCall) {
      await db.update(callParticipants)
        .set({ leftAt: new Date() })
        .where(and(eq(callParticipants.callId, activeCall.id), eq(callParticipants.userId, user.id)));

      if (filtered.length === 0) {
        await finalizeChannelCall(channelId, "ended");
      }
    }

    logger.info({
      message: `🔌 [Voice] User left channel: ${user.username}`,
      event: "voice_left",
      source: options.source,
      userId: user.id,
      channelId,
      socketId: socket.id,
    });
    io.emit("voice_occupants_update", { channelId, occupants: sanitizeVoiceOccupants(filtered) });
    emitVoiceEventToUsers(remainingUserIds, "voice_user_left", {
      channelId,
      userId: leavingUser.userId,
      username: leavingUser.username,
      avatarUrl: leavingUser.avatarUrl,
    });
  };

  const removeUserFromVoiceChannels = async () => {
    const allOccupants = await redisVoice.getAllOccupants();

    for (const [channelId, occupants] of Object.entries(allOccupants)) {
      if (!occupants.some((occupant) => occupant.userId === user.id)) {
        continue;
      }

      await leaveChannel(channelId, { source: "socket_disconnect_grace", expectedSocketId: socket.id });
    }
  };
  
  socket.on("join_voice_channel", async (channelId: string) => {
    if (isAdminPanel) return;

    const channel = await db.query.channels.findFirst({
      where: eq(channels.id, channelId),
      columns: { id: true, type: true },
    });

    if (!channel || channel.type !== "voice") {
      logger.warn("[Voice] Rejected join for non-voice or missing channel", { userId: user.id, channelId });
      return;
    }
    
    // Fetch latest user info for fresh avatarUrl
    const latestUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    // Clear user from all other voice channels first
    const allOccupants = await redisVoice.getAllOccupants();
    for (const [chId, occupants] of Object.entries(allOccupants)) {
      if (chId === channelId) continue;
      if (occupants.some((occupant: { userId: string }) => occupant.userId === user.id)) {
        await leaveChannel(chId);
      }
    }

    const { occupants: currentOccupants, joined, reconnected, previousUserIds, previousSocketId } = await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
      const now = Date.now();
      const previousUserIds = occupants.map((occupant) => occupant.userId);
      const existingOccupant = occupants.find((occupant) => occupant.userId === user.id);
      const avatarUrl = normalizeS3Url(latestUser?.avatarUrl) || latestUser?.avatarUrl || null;
      const reconnected = Boolean(existingOccupant && existingOccupant.socketId && existingOccupant.socketId !== socket.id);
      const nextOccupants = existingOccupant
        ? occupants.map((occupant) => occupant.userId === user.id
            ? {
                ...occupant,
                username: user.username,
                avatarUrl,
                socketId: socket.id,
                heartbeatAt: now,
              }
            : occupant,
          )
        : [
            ...occupants,
            {
              userId: user.id,
              username: user.username,
              avatarUrl,
              socketId: socket.id,
              joinedAt: now,
              heartbeatAt: now,
              isMuted: false,
              isDeafened: false,
            },
          ];

      return {
        occupants: nextOccupants,
        result: {
          occupants: nextOccupants,
          joined: !existingOccupant,
          reconnected,
          previousSocketId: existingOccupant?.socketId || null,
          previousUserIds,
        },
      };
    });

    if (joined) {
      await upsertParticipantJoin(channelId);
    }

    logger.info({
      message: joined
        ? `🎙️ [Voice] User joined channel: ${user.username}`
        : `[Voice] User refreshed voice channel: ${user.username}`,
      event: joined ? "voice_joined" : "voice_join_refreshed",
      source: joined ? "explicit_user_action" : "socket_reconnect",
      userId: user.id,
      channelId,
      socketId: socket.id,
      previousSocketId,
      reconnected,
    });
    io.emit("voice_occupants_update", { channelId, occupants: sanitizeVoiceOccupants(currentOccupants) });
    if (joined) {
      emitVoiceEventToUsers(previousUserIds, "voice_user_joined", {
        channelId,
        userId: user.id,
        username: user.username,
        avatarUrl: normalizeS3Url(latestUser?.avatarUrl) || latestUser?.avatarUrl || null,
      });
    }
  });

  socket.on("leave_voice_channel", async (channelId: string) => {
    try {
      await leaveChannel(channelId, { source: "explicit_user_action" });
    } catch (err) {
      logger.error("[Voice] leave_voice_channel Error", { error: err as Error });
    }
  });

  socket.on("disconnect", () => {
    logger.info({
      message: "[Voice] Disconnect grace started",
      event: "voice_disconnect_grace_started",
      source: "socket_disconnect_grace",
      graceMs: VOICE_DISCONNECT_GRACE_MS,
      userId: user.id,
      socketId: socket.id,
    });

    setTimeout(async () => {
      try {
        const isStillOnline = await redisPresence.isUserOnline(user.id);
        if (isStillOnline) {
          logger.info({
            message: "[Voice] Disconnect grace cancelled after reconnect",
            event: "voice_disconnect_grace_cancelled",
            source: "socket_reconnect",
            userId: user.id,
            socketId: socket.id,
          });
          return;
        }

        await removeUserFromVoiceChannels();
      } catch (err) {
        logger.error("[Voice] disconnect cleanup Error", { error: err as Error });
      }
    }, VOICE_DISCONNECT_GRACE_MS);
  });

  socket.on("voice_heartbeat", async ({ channelId }: { channelId: string }) => {
    try {
      if (!channelId || isAdminPanel) return;

      const currentOccupants = await redisVoice.getOccupants(channelId) as VoiceOccupant[];
      const isAlreadyOccupant = currentOccupants.some((occupant) => occupant.userId === user.id);
      let recoveryAvatarUrl: string | null = null;

      if (!isAlreadyOccupant) {
        const channel = await db.query.channels.findFirst({
          where: eq(channels.id, channelId),
          columns: { id: true, type: true },
        });

        if (!channel || channel.type !== "voice") {
          logger.warn("[Voice] Rejected heartbeat for non-voice or missing channel", { userId: user.id, channelId });
          return;
        }

        const latestUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { avatarUrl: true },
        });
        recoveryAvatarUrl = normalizeS3Url(latestUser?.avatarUrl) || latestUser?.avatarUrl || null;
      }

      const { recovered, occupants: updatedOccupants } = await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
        const now = Date.now();
        let recovered = false;
        const existingOccupant = occupants.find((occupant) => occupant.userId === user.id);
        const nextOccupants = existingOccupant
          ? occupants.map((occupant) => occupant.userId === user.id ? { ...occupant, socketId: socket.id, heartbeatAt: now } : occupant)
          : [
              ...occupants,
              {
                userId: user.id,
                username: user.username,
                avatarUrl: recoveryAvatarUrl,
                socketId: socket.id,
                joinedAt: now,
                heartbeatAt: now,
                isMuted: false,
                isDeafened: false,
              },
            ];

        if (!existingOccupant) {
          recovered = true;
        }

        return {
          occupants: nextOccupants,
          result: { recovered, occupants: nextOccupants },
        };
      });

      if (recovered) {
        await upsertParticipantJoin(channelId);
        logger.warn({
          message: "[Voice] Recovered missing voice occupant from heartbeat",
          event: "voice_occupant_restored",
          source: "heartbeat_recovery",
          userId: user.id,
          channelId,
          socketId: socket.id,
        });
        io.emit("voice_occupants_update", { channelId, occupants: sanitizeVoiceOccupants(updatedOccupants) });
      }
    } catch (err) {
      logger.error("[Voice] voice_heartbeat Error", { error: err as Error });
    }
  });

  socket.on("user_streaming_update", async ({ channelId, isStreaming }: { channelId: string, isStreaming: boolean }) => {
    try {
      if (!channelId) return;
      const updated = await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
        const nextOccupants = occupants.map((occupant: any) =>
          occupant.userId === user.id ? { ...occupant, socketId: socket.id, isStreaming, heartbeatAt: Date.now() } : occupant,
        );
        return { occupants: nextOccupants, result: nextOccupants };
      });
      io.emit("voice_occupants_update", { channelId, occupants: sanitizeVoiceOccupants(updated) });
    } catch (err) {
      logger.error("[Voice] user_streaming_update Error", { error: err as Error });
    }
  });

  socket.on("user_speaking_update", async ({ channelId, isSpeaking }: { channelId: string, isSpeaking: boolean }) => {
    try {
      if (!channelId) return;
      await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
        const updated = occupants.map((occupant: any) =>
          occupant.userId === user.id ? { ...occupant, socketId: socket.id, isSpeaking, heartbeatAt: Date.now() } : occupant,
        );
        return { occupants: updated, result: updated };
      });

      // Efficient narrow broadcast
      io.emit("user_speaking_status", { channelId, userId: user.id, isSpeaking });
    } catch (err) {
      logger.error("[Voice] user_speaking_update Error", { error: err as Error });
    }
  });

  socket.on(
    "user_audio_status_update",
    async ({ channelId, isMuted, isDeafened }: { channelId: string; isMuted: boolean; isDeafened: boolean }) => {
      try {
        if (!channelId) return;

        const updatedOccupants = await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
          const updated = occupants.map((occupant: any) =>
            occupant.userId === user.id ? { ...occupant, socketId: socket.id, isMuted, isDeafened, heartbeatAt: Date.now() } : occupant,
          );
          return { occupants: updated, result: updated };
        });
        io.emit("user_audio_status", { channelId, userId: user.id, isMuted, isDeafened });
        io.emit("voice_occupants_update", { channelId, occupants: sanitizeVoiceOccupants(updatedOccupants) });
      } catch (err) {
        logger.error("[Voice] user_audio_status_update Error", { error: err as Error });
      }
    },
  );
}

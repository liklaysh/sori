import { Server, Socket } from "socket.io";
import { redisPresence, redisVoice } from "../../utils/redis.js";
import { db } from "../../db/index.js";
import { callParticipants, calls, channels, users } from "../../db/schema.js";
import { and, eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { normalizeS3Url } from "../../utils/url.js";
import { nanoid } from "nanoid";
import { redisCallTelemetry } from "../../utils/redis.js";
import { telemetryAggregateToCallUpdate } from "../../utils/callTelemetry.js";

const VOICE_DISCONNECT_GRACE_MS = 120_000;

type VoiceOccupant = {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  joinedAt?: number;
  heartbeatAt?: number;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isStreaming?: boolean;
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

  const leaveChannel = async (channelId: string) => {
    if (!channelId) {
      return;
    }

    const { changed, occupants: filtered, remainingUserIds, leavingUser } = await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
      const leavingOccupant = occupants.find((occupant) => occupant.userId === user.id);
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
        },
      };
    });

    if (!changed) {
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

    logger.info({ message: `🔌 [Voice] User left channel: ${user.username}`, userId: user.id, channelId });
    io.emit("voice_occupants_update", { channelId, occupants: filtered });
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

      await leaveChannel(channelId);
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

    const { occupants: currentOccupants, joined, previousUserIds } = await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
      const now = Date.now();
      const previousUserIds = occupants.map((occupant) => occupant.userId);
      const existingOccupant = occupants.find((occupant) => occupant.userId === user.id);
      const avatarUrl = normalizeS3Url(latestUser?.avatarUrl) || latestUser?.avatarUrl || null;
      const nextOccupants = existingOccupant
        ? occupants.map((occupant) => occupant.userId === user.id
            ? {
                ...occupant,
                username: user.username,
                avatarUrl,
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
          previousUserIds,
        },
      };
    });

    await upsertParticipantJoin(channelId);

    logger.info({ message: `🎙️ [Voice] User joined channel: ${user.username}`, userId: user.id, channelId });
    io.emit("voice_occupants_update", { channelId, occupants: currentOccupants });
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
      await leaveChannel(channelId);
    } catch (err) {
      logger.error("[Voice] leave_voice_channel Error", { error: err as Error });
    }
  });

  socket.on("disconnect", () => {
    setTimeout(async () => {
      try {
        const isStillOnline = await redisPresence.isUserOnline(user.id);
        if (isStillOnline) {
          logger.debug("[Voice] Skipped disconnect cleanup after quick reconnect", { userId: user.id });
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
          ? occupants.map((occupant) => occupant.userId === user.id ? { ...occupant, heartbeatAt: now } : occupant)
          : [
              ...occupants,
              {
                userId: user.id,
                username: user.username,
                avatarUrl: recoveryAvatarUrl,
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
        logger.warn("[Voice] Recovered missing voice occupant from heartbeat", { userId: user.id, channelId });
        io.emit("voice_occupants_update", { channelId, occupants: updatedOccupants });
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
          occupant.userId === user.id ? { ...occupant, isStreaming, heartbeatAt: Date.now() } : occupant,
        );
        return { occupants: nextOccupants, result: nextOccupants };
      });
      io.emit("voice_occupants_update", { channelId, occupants: updated });
    } catch (err) {
      logger.error("[Voice] user_streaming_update Error", { error: err as Error });
    }
  });

  socket.on("user_speaking_update", async ({ channelId, isSpeaking }: { channelId: string, isSpeaking: boolean }) => {
    try {
      if (!channelId) return;
      await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
        const updated = occupants.map((occupant: any) =>
          occupant.userId === user.id ? { ...occupant, isSpeaking, heartbeatAt: Date.now() } : occupant,
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

        await redisVoice.updateOccupants(channelId, async (occupants: VoiceOccupant[]) => {
          const updated = occupants.map((occupant: any) =>
            occupant.userId === user.id ? { ...occupant, isMuted, isDeafened, heartbeatAt: Date.now() } : occupant,
          );
          return { occupants: updated, result: updated };
        });
        io.emit("user_audio_status", { channelId, userId: user.id, isMuted, isDeafened });
      } catch (err) {
        logger.error("[Voice] user_audio_status_update Error", { error: err as Error });
      }
    },
  );
}

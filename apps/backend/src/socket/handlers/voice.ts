import { Server, Socket } from "socket.io";
import { redisVoice } from "../../utils/redis.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";

export function handleVoice(io: Server, socket: Socket, user: { id: string, username: string, role: string }, isAdminPanel: boolean) {
  
  socket.on("join_voice_channel", async (channelId: string) => {
    if (isAdminPanel) return;
    
    // Fetch latest user info for fresh avatarUrl
    const latestUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    // Clear user from all other voice channels first
    const allOccupants = await redisVoice.getAllOccupants();
    for (const [chId, occupants] of Object.entries(allOccupants)) {
      if (chId === channelId) continue;
      const filtered = occupants.filter(o => o.userId !== user.id);
      if (filtered.length !== occupants.length) {
        if (filtered.length === 0) {
          await redisVoice.removeChannel(chId);
        } else {
          await redisVoice.setOccupants(chId, filtered);
        }
        io.emit("voice_occupants_update", { channelId: chId, occupants: filtered });
      }
    }

    const currentOccupants = await redisVoice.getOccupants(channelId);
    if (!currentOccupants.find((o: any) => o.userId === user.id)) {
      currentOccupants.push({ 
        userId: user.id, 
        username: user.username, 
        avatarUrl: latestUser?.avatarUrl || null, 
        joinedAt: Date.now() 
      });
      await redisVoice.setOccupants(channelId, currentOccupants);
    }

    logger.info({ message: `🎙️ [Voice] User joined channel: ${user.username}`, userId: user.id, channelId });
    io.emit("voice_occupants_update", { channelId, occupants: currentOccupants });
  });

  socket.on("leave_voice_channel", async (channelId: string) => {
    const occupants = await redisVoice.getOccupants(channelId);
    const filtered = occupants.filter((o: any) => o.userId !== user.id);
    if (filtered.length === 0) {
      await redisVoice.removeChannel(channelId);
    } else {
      await redisVoice.setOccupants(channelId, filtered);
    }
    logger.info({ message: `🔌 [Voice] User left channel: ${user.username}`, userId: user.id, channelId });
    io.emit("voice_occupants_update", { channelId, occupants: filtered });
  });

  socket.on("user_streaming_update", async ({ channelId, isStreaming }: { channelId: string, isStreaming: boolean }) => {
    try {
      if (!channelId) return;
      const occupants = await redisVoice.getOccupants(channelId);
      const updated = occupants.map((o: any) => 
        o.userId === user.id ? { ...o, isStreaming } : o
      );
      await redisVoice.setOccupants(channelId, updated);
      io.emit("voice_occupants_update", { channelId, occupants: updated });
    } catch (err) {
      console.error("[Voice] user_streaming_update Error:", err);
    }
  });
}

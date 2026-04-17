import { Server, Socket } from "socket.io";
import { redisPresence, redisVoice } from "../../utils/redis.js";

export function handlePresence(io: Server, socket: Socket, user: { id: string, username: string, role: string }) {
  // Disconnect logic moved to socket.ts main handler for better coordination 
  // but we could also handle it here if we pass the right callbacks.
  // Actually, let's keep the module-specific cleanup here.

  socket.on("disconnect", async () => {
    // 1. Remove from all voice channels in Redis
    const allOccupants = await redisVoice.getAllOccupants();
    for (const [chId, occupants] of Object.entries(allOccupants)) {
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
    
    // 2. Presence cleanup is already handled in socket.ts main disconnect handler
  });
}

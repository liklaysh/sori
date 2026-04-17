import { Server } from "socket.io";
import type { Socket as BaseSocket } from "socket.io";
import { verify } from "hono/jwt";
import { db } from "./db/index.js";
import { members, channels, users } from "./db/schema.js";
import { config } from "./config.js";
import { setGlobalIo } from "./globals.js";
import { eq, inArray, and } from "drizzle-orm";
import { createAdapter } from "@socket.io/redis-adapter";
import { pubClient, subClient, redisPresence, redisVoice } from "./utils/redis.js";
import { logger } from "./utils/logger.js";
import { nanoid } from "nanoid";

import { handlePresence } from "./socket/handlers/presence.js";
import { handleVoice } from "./socket/handlers/voice.js";
import { handleMessages } from "./socket/handlers/messages.js";
import { handleCalls } from "./socket/handlers/calls.js";
import { rateLimiter } from "./middleware/rateLimiter.js";

import { Socket, UserProfile } from "./types/socket.js";

export function initSocket(server: any) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Storage for pending offline updates to allow cancellation on quick reconnect
  const pendingOfflineUpdates = new Map<string, NodeJS.Timeout>();
  
  // Use Redis adapter for horizontal scaling
  io.adapter(createAdapter(pubClient, subClient));
  setGlobalIo(io);

  // Authenticate middleware
  io.use(async (socket: BaseSocket, next: (err?: Error) => void) => {
    let token = socket.handshake.auth.token;
    
    // Fallback to cookie if auth token is missing (useful for cookie-based auth)
    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('sori_auth='));
      if (authCookie) {
        token = authCookie.split('=')[1].trim();
      }
    }

    if (!token) {
      console.log("[Socket Auth] No token found in auth or cookies");
      return next(new Error("Authentication error"));
    }
    
    try {
      const payload = await verify(token, config.jwt.secret, "HS256");
      (socket as Socket).user = payload as unknown as UserProfile;
      
      // Request Tracking for Sockets
      const requestId = socket.handshake.auth.requestId || nanoid();
      socket.data.requestId = requestId;
      
      next();
    } catch (err: any) {
      logger.error("[Socket Auth] Verify failed", { error: err });
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket: BaseSocket) => {
    const authSocket = socket as Socket;
    const user = authSocket.user;
    const isAdminPanel = user.role === 'adminpanel';
    const requestId = socket.data.requestId;
    
    logger.info({
      message: `🔌 [Socket] Connection established: ${user.username}`,
      socketId: socket.id,
      userId: user.id,
      requestId,
      role: user.role
    });
    
    // Clear any pending offline update
    if (pendingOfflineUpdates.has(user.id)) {
      logger.info({ message: `[Presence] User ${user.username} reconnected. Cancelling offline update.`, userId: user.id, requestId });
      clearTimeout(pendingOfflineUpdates.get(user.id)!);
      pendingOfflineUpdates.delete(user.id);
    }

    // Join a room specific to the user for easy DM delivery
    socket.join(`user:${user.id}`);
    
    // Store user info in socket data for easier filtering later if needed
    socket.data.user = user;    // Add socket to user's set in Redis
    const wasOffline = !(await redisPresence.isUserOnline(user.id));
    await redisPresence.addUserSocket(user.id, socket.id);

    // Heartbeat interval (refresh presence every 15s)
    const hbInterval = setInterval(() => {
      redisPresence.refreshHeartbeat(user.id, socket.id).catch(() => {});
    }, 15000);

    if (wasOffline && !isAdminPanel) {
      io.emit("presence_update", { userId: user.id, status: "online" });
    }

    // Join admin logs room if authorized
    if (isAdminPanel) {
      socket.join("admin_logs");
      console.log(`[Socket] Admin ${user.username} joined admin_logs room.`);
    }

    // Auto-join all channels the user is a member of for notifications
    if (!isAdminPanel) {
      try {
        const userCommunities = await db.select({ id: members.communityId })
          .from(members)
          .where(eq(members.userId, user.id));
        
        if (userCommunities.length > 0) {
          const communityIds = userCommunities.map(c => c.id as string);
          const allChannels = await db.select({ id: channels.id })
            .from(channels)
            .where(inArray(channels.communityId, communityIds));
          
          allChannels.forEach(ch => {
             socket.join(ch.id);
          });
          console.log(`[Socket] User ${user.username || 'unknown'} joined ${allChannels.length} channels.`);
        }
      } catch (err) {
        console.error("[Socket] Failed to join channels:", err);
      }
    }
    
    const allVoiceOccupants = await redisVoice.getAllOccupants();
    socket.emit("voice_occupants_state", allVoiceOccupants);
    
    // Initial presence sync
    const onlineUserIds = await redisPresence.getGlobalOnlineUsers();
    
    // Filter out adminpanel users from presence
    let filteredOnlineIds = onlineUserIds;
    if (onlineUserIds.length > 0) {
      const adminUsers = await db.select({ id: users.id })
        .from(users)
        .where(and(
          inArray(users.id, onlineUserIds),
          eq(users.role, 'adminpanel')
        ));
      const adminIds = new Set(adminUsers.map(u => u.id));
      filteredOnlineIds = onlineUserIds.filter(id => !adminIds.has(id));
    }
    
    console.log(`[Socket] Sending initial_presence to ${user.username} (socket ${socket.id}):`, filteredOnlineIds);
    socket.emit("initial_presence", filteredOnlineIds);
    
    socket.on("get_voice_state", async () => {
      try {
        const state = await redisVoice.getAllOccupants();
        socket.emit("voice_occupants_state", state);
      } catch (err) {
        console.error("[Socket] get_voice_state error:", err);
      }
    });
    
    // Tell the new user who is already online (this is still a bit expensive, but better with Redis)
    // In a huge app, we'd only fetch presence for the user's friends/community members.
    // For now, we'll keep it simple.
    
    socket.on("join_channel", (channelId: string) => {
      console.log(`📡 [Socket] User ${user.username} joining channel: ${channelId}`);
      if (isAdminPanel && channelId !== "admin_logs") return;
      socket.join(channelId);
    });

    socket.on("typing", (dataValue: { channelId: string, isTyping: boolean }) => {
      const { channelId, isTyping } = dataValue;
      if (isTyping) console.log(`⌨️  [Socket] User ${user.username} is typing in ${channelId}`);
      socket.to(channelId).emit("user_typing", {
        userId: user.id,
        username: user.username,
        isTyping
      });
    });

    // Simple Event Rate Limiter for Sockets
    const socketEventLimits = new Map<string, { count: number, reset: number }>();
    socket.use(([event, ...args], next) => {
      const now = Date.now();
      const limitKey = `${socket.id}:${event}`;
      const limit = socketEventLimits.get(limitKey);

      if (!limit || now > limit.reset) {
        socketEventLimits.set(limitKey, { count: 1, reset: now + 1000 });
        return next();
      }

      limit.count++;
      if (limit.count > 10) { // Max 10 events per second per event type
        logger.warn(`🔌 [Socket Rate Limit] Exceeded for event: ${event}`, { 
          socketId: socket.id, 
          userId: user.id,
          event,
          count: limit.count
        });
        return; // Silently drop
      }
      next();
    });

    // Delegate to module handlers
    handlePresence(io, authSocket, user);
    handleVoice(io, authSocket, user, isAdminPanel);
    handleMessages(io, authSocket, user, isAdminPanel);
    handleCalls(io, authSocket, user);
    
    // Leak Detection & Listener Audit
    const monitoredEvents = ["join_channel", "typing", "get_voice_state", "disconnect"];
    monitoredEvents.forEach(event => {
      const count = socket.listenerCount(event);
      if (count > 1) {
        logger.warn({
          message: `🚨 [Socket Leak] Multiple listeners detected for event: ${event}`,
          event,
          count,
          socketId: socket.id,
          userId: user.id,
          requestId
        });
      }
    });

    socket.on("disconnect", async (reason) => {
      logger.info({
        message: `🔌 [Socket] Disconnected: ${user.username}`,
        reason,
        socketId: socket.id,
        userId: user.id,
        requestId
      });
      clearInterval(hbInterval);
      await redisPresence.removeUserSocket(user.id, socket.id);

      // Delay offline broadcast to handle quick reconnections/page refreshes
      const timeout = setTimeout(async () => {
        pendingOfflineUpdates.delete(user.id);
        const isStillOnline = await redisPresence.isUserOnline(user.id);
        
        if (!isStillOnline && !isAdminPanel) {
          console.log(`[Presence] User ${user.username} is still offline after delay. Emitting offline update.`);
          io.emit("presence_update", { userId: user.id, status: "offline" });
        }
      }, 3000); // 3 second grace period

      pendingOfflineUpdates.set(user.id, timeout);
    });
  });

  return io;
}

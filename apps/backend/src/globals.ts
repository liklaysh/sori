import type { Server } from "socket.io";

// State is now managed in Redis (utils/redis.ts) for horizontal scaling.
// Global maps for legacy/special coordination if needed
// but functional logic has been moved to RedisStore.

export let globalIo: Server | null = null;
export const setGlobalIo = (io: Server) => { globalIo = io; };
export const getGlobalIo = () => globalIo;

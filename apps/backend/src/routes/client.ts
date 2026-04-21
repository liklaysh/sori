import { Hono } from "hono";
import { db } from "../db/index.js";
import { serverSettings } from "../db/schema.js";
import { config } from "../config.js";
import { safe } from "../utils/safe.js";

const client = new Hono();

async function getServerName() {
  const settings = await db.select().from(serverSettings);
  const byKey = new Map(settings.map((entry) => [entry.key, entry.value]));
  return byKey.get("ServerName") || byKey.get("server_name") || "Sori Sanctuary";
}

async function buildBootstrapPayload() {
  const serverName = await getServerName();

  return {
    version: 1,
    server: {
      name: serverName,
      installMode: "single-community",
      defaultCommunityId: config.public.defaultCommunityId,
    },
    endpoints: {
      web: config.public.webUrl,
      api: config.public.apiUrl,
      ws: config.public.wsUrl,
      livekit: config.public.livekitUrl,
      media: config.public.mediaUrl,
      health: `${config.public.apiUrl.replace(/\/+$/, "")}/health`,
    },
    auth: {
      mode: "cookie",
      loginPath: "/auth/login",
      mePath: "/auth/me",
      refreshPath: "/auth/refresh",
      logoutPath: "/auth/logout",
    },
    realtime: {
      socketPath: "/socket.io",
      transports: ["websocket"],
    },
    upload: {
      maxUploadSizeMb: config.storage.maxUploadSizeMb,
    },
    features: {
      directMessages: true,
      directCalls: true,
      voiceChannels: true,
      mediaUploads: true,
      multiCommunity: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

client.get("/bootstrap", safe(async (c) => {
  return c.json(await buildBootstrapPayload());
}));

client.get("/.well-known/sori/client.json", safe(async (c) => {
  return c.json(await buildBootstrapPayload());
}));

export default client;

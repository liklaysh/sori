import { Hono } from "hono";
import { db } from "../db/index.js";
import { calls, channels, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { safe } from "../utils/safe.js";
import { config } from "../config.js";
import { AccessToken } from "livekit-server-sdk";
import { normalizeS3Url } from "../utils/url.js";
import { logger } from "../utils/logger.js";

const router = new Hono();

router.post("/token", authMiddleware, safe(async (c) => {
  const payload = (c.get("jwtPayload") || {}) as any;
  const { channelId, callId } = await c.req.json();

  if (!channelId && !callId) return c.json({ error: "channelId or callId is required" }, 400);

  const roomId = channelId || `call_${callId}`;

  try {
    let startTime = Date.now();

    if (channelId) {
      const channel = await db.query.channels.findFirst({
        where: eq(channels.id, channelId),
        columns: {
          id: true,
          type: true,
        },
      });

      if (!channel || channel.type !== "voice") {
        return c.json({ error: "Voice channel not found" }, 404);
      }

      const activeCall = await db.query.calls.findFirst({
        where: and(eq(calls.type, "channel"), eq(calls.channelId, channelId), eq(calls.isActive, true)),
      });

      if (activeCall) {
        startTime = activeCall.startedAt?.getTime() || Date.now();
      }
    } else if (callId) {
      const callRecord = await db.query.calls.findFirst({
        where: eq(calls.id, callId)
      });

      if (!callRecord || callRecord.type !== "direct") {
        return c.json({ error: "Call not found" }, 404);
      }

      if (callRecord.callerId !== payload.id && callRecord.calleeId !== payload.id) {
        return c.json({ error: "Call access denied" }, 403);
      }

      startTime = callRecord.startedAt?.getTime() || Date.now();
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, payload.id)
    });

    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: payload.id,
      name: payload.username,
      metadata: JSON.stringify({ avatar: normalizeS3Url(userRecord?.avatarUrl || "") })
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
    });

    return c.json({ 
      token: await at.toJwt(),
      startedAt: startTime
    });
  } catch (err) {
    logger.error("[Calls] Error generating token", { error: err as Error });
    return c.json({ error: "Failed to generate token" }, 500);
  }
}));

export default router;

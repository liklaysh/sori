import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories, channels, communities, serverSettings } from "../db/schema.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const DEFAULT_COMMUNITY_ID = config.public.defaultCommunityId;
const DEFAULT_TEXT_CATEGORY_ID = "cat-text";
const DEFAULT_VOICE_CATEGORY_ID = "cat-voice";
const DEFAULT_TEXT_CHANNEL_ID = "main";
const DEFAULT_VOICE_CHANNEL_ID = "main-voice";

export async function ensureDefaultStructure() {
  const existing = await db.query.communities.findFirst({
    where: eq(communities.id, DEFAULT_COMMUNITY_ID),
  });

  if (existing) {
    return false;
  }

  logger.info("🌱 Seeding default structure...");

  await db.insert(communities).values({
    id: DEFAULT_COMMUNITY_ID,
    name: "Sori Sanctuary",
  });

  await db.insert(categories).values([
    {
      id: DEFAULT_TEXT_CATEGORY_ID,
      name: "Text Channels",
      communityId: DEFAULT_COMMUNITY_ID,
      order: 0,
    },
    {
      id: DEFAULT_VOICE_CATEGORY_ID,
      name: "Voice Channels",
      communityId: DEFAULT_COMMUNITY_ID,
      order: 1,
    },
  ]);

  await db.insert(channels).values([
    {
      id: DEFAULT_TEXT_CHANNEL_ID,
      name: "main",
      type: "text",
      communityId: DEFAULT_COMMUNITY_ID,
      categoryId: DEFAULT_TEXT_CATEGORY_ID,
      order: 0,
    },
    {
      id: DEFAULT_VOICE_CHANNEL_ID,
      name: "main_voice",
      type: "voice",
      communityId: DEFAULT_COMMUNITY_ID,
      categoryId: DEFAULT_VOICE_CATEGORY_ID,
      order: 0,
    },
  ]);

  logger.info("✅ Default community structure created");
  return true;
}

export async function ensureServerSettings(serverName?: string) {
  const desiredName = serverName?.trim() || "Sori Sanctuary";

  await db.insert(serverSettings).values({
    key: "ServerName",
    value: desiredName,
  }).onConflictDoUpdate({
    target: serverSettings.key,
    set: {
      value: desiredName,
      updatedAt: new Date(),
    },
  });

  await db.insert(serverSettings).values({
    key: "server_name",
    value: desiredName,
  }).onConflictDoUpdate({
    target: serverSettings.key,
    set: {
      value: desiredName,
      updatedAt: new Date(),
    },
  });

  await db.insert(serverSettings).values({
    key: "public_registration",
    value: "false",
  }).onConflictDoUpdate({
    target: serverSettings.key,
    set: {
      value: "false",
      updatedAt: new Date(),
    },
  });
}

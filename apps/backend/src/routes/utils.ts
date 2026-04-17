import { Hono } from "hono";
import { getSingleLinkPreview } from "../utils/linkPreview.js";
import { authMiddleware } from "../middleware/auth.js";
import { safe } from "../utils/safe.js";
import { logger } from "../utils/logger.js";

const utils = new Hono();

// Apply auth to all utils routes
utils.use("*", authMiddleware);

/**
 * Endpoint for fetching link metadata (Live Preview)
 * Usage: GET /api/utils/link-preview?url=https://google.com
 */
utils.get("/link-preview", safe(async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "URL is required" }, 400);
  }

  try {
    const preview = await getSingleLinkPreview(url);
    if (!preview) {
      return c.json({ error: "Failed to fetch preview" }, 404);
    }

    return c.json(preview);
  } catch (error) {
    logger.error("❌ [UtilsRoute] Preview Error", { error: error as Error });
    return c.json({ error: "Internal server error" }, 500);
  }
}));

export default utils;

import { Context, Next, Handler } from "hono";
import { logger } from "./logger.js";

export const safe = (handler: Handler): Handler => {
  return async (c: Context, next: Next) => {
    try {
      return await handler(c, next);
    } catch (err: any) {
      const requestId = c.get("requestId");
      
      // Minimal log for local context, main log happens in app.onError
      logger.debug(`[Safe Boundary] Error in ${c.req.method} ${c.req.path}`, { 
        requestId,
        error: err.message 
      });

      // Re-throw to global handler
      throw err;
    }
  };
};

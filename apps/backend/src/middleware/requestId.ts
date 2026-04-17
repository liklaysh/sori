import { Context, Next } from "hono";
import { nanoid } from "nanoid";

export const requestIdMiddleware = async (c: Context, next: Next) => {
  // Check if requestId is already present in headers (provided by client or upstream)
  let requestId = c.req.header("X-Request-ID") || c.req.header("x-request-id");
  
  if (!requestId) {
    requestId = nanoid();
  }

  // Set in context for downstream use
  c.set("requestId", requestId);
  
  // Also set in response headers
  c.header("X-Request-ID", requestId);
  
  await next();
};

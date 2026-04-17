import { Hono } from "hono";
import { safe } from "../utils/safe.js";

const time = new Hono();

time.get("/", safe(async (c) => {
  return c.json({
    time: new Date().toISOString(),
    timestamp: Date.now()
  });
}));

export default time;

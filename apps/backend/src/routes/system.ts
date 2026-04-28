import { Hono } from "hono";
import { safe } from "../utils/safe.js";
import { getSystemVersion } from "../utils/version.js";

const system = new Hono();

system.get("/version", safe(async (c) => {
  return c.json(getSystemVersion());
}));

export default system;

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { uploadFile } from "../utils/s3.js";
import { nanoid } from "nanoid";
import { safe } from "../utils/safe.js";

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "../utils/s3.js";
import { logger } from "../utils/logger.js";

const app = new Hono();

app.post("/", authMiddleware, safe(async (c) => {
  const requestId = c.get("requestId");
  const user = c.get("jwtPayload");

  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  if (file.size > MAX_SIZE) {
    return c.json({ error: "File too large (max 25MB)" }, 400);
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split('.').pop();
  const key = `${nanoid()}.${extension}`;
  
  // 1. Upload
  const fileUrl = await uploadFile(key, fileBuffer, file.type);

  // 2. Immediate Verification (HeadObject)
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
    logger.info({ 
      message: "🚀 Upload & Verification Successful", 
      key, 
      bucket: BUCKET_NAME, 
      url: fileUrl,
      requestId,
      userId: user?.id
    });
  } catch (err: any) {
    const statusCode = err.$metadata?.httpStatusCode;
    logger.error({ 
      message: `❌ Post-upload verification failed (${statusCode})`, 
      key, 
      bucket: BUCKET_NAME,
      requestId,
      userId: user?.id
    }, { error: err });
    
    if (statusCode === 404) {
      return c.json({ error: "File uploaded but not found in storage" }, 500);
    }
    if (statusCode === 403) {
      return c.json({ error: "Storage permission error after upload" }, 500);
    }
    throw err;
  }

  return c.json({
    fileUrl,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    requestId
  });
}));

export default app;

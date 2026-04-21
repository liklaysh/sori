import { Hono } from "hono";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { authMiddleware } from "../middleware/auth.js";
import { uploadFile } from "../utils/s3.js";
import { nanoid } from "nanoid";
import { safe } from "../utils/safe.js";
import { config } from "../config.js";

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "../utils/s3.js";
import { logger } from "../utils/logger.js";

const app = new Hono();

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "application/x-msdownload",
  "application/x-dosexec",
  "application/x-sh",
  "application/x-httpd-php",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".flac",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".pdf",
  ".zip",
  ".7z",
  ".rar",
  ".gz",
  ".tar",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);

function normalizeMimeType(file: File): string {
  return (file.type || "application/octet-stream").toLowerCase();
}

function getSafeExtension(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  if (!ext || !/^\.[a-z0-9]+$/.test(ext)) {
    return "";
  }

  return ext;
}

function isAllowedUpload(file: File): boolean {
  const mimeType = normalizeMimeType(file);
  const extension = getSafeExtension(file.name);

  if (BLOCKED_MIME_TYPES.has(mimeType)) {
    return false;
  }

  if (ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true;
  }

  if (ALLOWED_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return extension ? ALLOWED_EXTENSIONS.has(extension) : false;
}

app.post("/", authMiddleware, safe(async (c) => {
  const requestId = c.get("requestId");
  const user = c.get("jwtPayload");

  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const MAX_SIZE = config.storage.maxUploadSizeMb * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return c.json({ error: `File too large (max ${config.storage.maxUploadSizeMb}MB)` }, 400);
  }

  if (!isAllowedUpload(file)) {
    return c.json({ error: "Unsupported file type" }, 400);
  }

  const extension = getSafeExtension(file.name);
  const key = `${nanoid()}${extension}`;
  const contentType = normalizeMimeType(file);
  const fileStream = Readable.fromWeb(file.stream() as any);
  
  // 1. Upload
  const fileUrl = await uploadFile(key, fileStream, contentType, file.size, file.name);

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
    attachment: {
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: contentType,
    },
    requestId
  });
}));

export default app;

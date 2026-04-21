import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { config } from "../config.js";
import { logger } from "./logger.js";

const S3_ENDPOINT = config.s3.endpoint;
const S3_PUBLIC_URL = config.s3.publicUrl;
const S3_REGION = config.s3.region;
const S3_ACCESS_KEY = config.s3.accessKey;
const S3_SECRET_KEY = config.s3.secretKey;
export const BUCKET_NAME = config.s3.bucket;

export const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    logger.info(`📡 [S3] Initialized: Bucket "${BUCKET_NAME}" is active.`);
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      logger.info(`📡 [S3] Action Required: Creating bucket "${BUCKET_NAME}"...`);
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        
        // Make bucket public for reading
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicRead",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
            },
          ],
        };

        await s3Client.send(new PutBucketPolicyCommand({
          Bucket: BUCKET_NAME,
          Policy: JSON.stringify(policy),
        }));
        
        logger.info(`📡 [S3] Success: Bucket "${BUCKET_NAME}" provisioned with PublicRead policy.`);
      } catch (createErr) {
        logger.error("❌ [S3] Critical Failure: Could not create bucket", { error: createErr as Error });
        throw createErr;
      }
    } else {
      logger.error("❌ [S3] Connection Error: Could not verify bucket existence", { error: err as Error });
    }
  }
}

export async function uploadFile(
  key: string,
  body: Buffer | Readable,
  contentType: string,
  contentLength?: number,
  originalFileName?: string,
) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: "public, max-age=31536000, immutable",
      ContentDisposition: buildContentDisposition(contentType, originalFileName),
    });
    await s3Client.send(command);
    
    const baseUrl = S3_PUBLIC_URL.endsWith("/") ? S3_PUBLIC_URL.slice(0, -1) : S3_PUBLIC_URL;
    const url = `${baseUrl}/${BUCKET_NAME}/${key}`;
    
    logger.info({ message: `📡 [S3] Upload successful`, key, bucket: BUCKET_NAME, url });
    return url;
  } catch (err) {
    logger.error(`❌ [S3] Upload failed for key: ${key}`, { error: err as Error, bucket: BUCKET_NAME });
    throw new Error("Failed to upload file to storage.");
  }
}

function sanitizeDownloadName(fileName?: string) {
  if (!fileName) {
    return "download";
  }

  const cleaned = fileName
    .replace(/[\r\n"]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .trim();

  return cleaned || "download";
}

function buildContentDisposition(contentType: string, fileName?: string) {
  const safeName = sanitizeDownloadName(fileName);
  const inlineSafe = contentType.startsWith("image/")
    || contentType.startsWith("video/")
    || contentType.startsWith("audio/")
    || contentType === "application/pdf"
    || contentType === "text/plain";

  const disposition = inlineSafe ? "inline" : "attachment";
  return `${disposition}; filename="${safeName}"`;
}

export async function getStorageStats() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });
    const response = await s3Client.send(command);
    
    const objectCount = response.KeyCount || 0;
    const totalSize = (response.Contents || []).reduce((acc, obj) => acc + (obj.Size || 0), 0);
    
    return { objectCount, totalSize };
  } catch (err) {
    logger.error("❌ [S3] Failed to fetch storage stats", { error: err as Error });
    return { objectCount: 0, totalSize: 0 };
  }
}

export async function listRecentFiles(limit: number = 50) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: limit,
    });
    const response = await s3Client.send(command);
    
    const baseUrl = S3_PUBLIC_URL.endsWith("/") ? S3_PUBLIC_URL.slice(0, -1) : S3_PUBLIC_URL;

    return (response.Contents || [])
      .filter(obj => obj.Key) // Ensure key exists
      .map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        url: `${baseUrl}/${BUCKET_NAME}/${obj.Key}`
      }))
      .sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0));
  } catch (err) {
    logger.error("❌ [S3] Failed to list files", { error: err as Error });
    return [];
  }
}

export async function deleteFile(key: string) {
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    logger.info({ message: `📡 [S3] Deletion successful`, key, bucket: BUCKET_NAME });
    return true;
  } catch (err) {
    logger.error(`❌ [S3] Deletion failed for key: ${key}`, { error: err as Error, bucket: BUCKET_NAME });
    throw new Error("Failed to delete object from storage.");
  }
}

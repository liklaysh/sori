import { config } from "../config.js";
import { redis } from "./redis.js";
import type { MessageAttachment } from "./messageContract.js";

const UPLOADED_ATTACHMENT_PREFIX = "uploaded_attachment:";
const UPLOADED_ATTACHMENT_TTL_SECONDS = 7 * 24 * 60 * 60;

type UploadedAttachmentRecord = {
  ownerId: string;
  key: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: number;
};

function normalizeBaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return "";
  }
}

const allowedOrigins = new Set(
  [
    normalizeBaseUrl(config.s3.publicUrl),
    normalizeBaseUrl(config.public.mediaUrl),
  ].filter(Boolean),
);

export function extractSoriAttachmentKey(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    if (!allowedOrigins.has(parsed.origin)) {
      return null;
    }

    let key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    const bucketPrefix = `${config.s3.bucket}/`;
    if (key.startsWith(bucketPrefix)) {
      key = key.slice(bucketPrefix.length);
    }

    if (!key || key.includes("..") || key.includes("/") || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(key)) {
      return null;
    }

    return key;
  } catch {
    return null;
  }
}

export async function registerUploadedAttachment(args: {
  key: string;
  ownerId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}) {
  const record: UploadedAttachmentRecord = {
    ...args,
    createdAt: Date.now(),
  };

  await redis.set(
    `${UPLOADED_ATTACHMENT_PREFIX}${args.key}`,
    JSON.stringify(record),
    "EX",
    UPLOADED_ATTACHMENT_TTL_SECONDS,
  );
}

export async function validateAttachmentsBelongToUser(attachments: MessageAttachment[], userId: string) {
  for (const attachment of attachments) {
    const key = extractSoriAttachmentKey(attachment.fileUrl);
    if (!key) {
      throw new Error("Attachment URL is not managed by Sori");
    }

    const rawRecord = await redis.get(`${UPLOADED_ATTACHMENT_PREFIX}${key}`);
    if (!rawRecord) {
      throw new Error("Attachment upload record is missing or expired");
    }

    const record = JSON.parse(rawRecord) as UploadedAttachmentRecord;
    if (record.ownerId !== userId) {
      throw new Error("Attachment belongs to another user");
    }
  }
}

import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const loginSchema = z.object({
  email: z.string(), // can be email or username
  password: z.string(),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(32).regex(/^[a-z0-9-_]+$/, "Channel names can only contain lowercase letters, numbers, hyphens, and underscores"),
  type: z.enum(["text", "voice"]),
  categoryId: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/).optional().or(z.string().length(0)),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(32),
});

export const attachmentSchema = z.object({
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative().optional(),
  fileType: z.string().optional()
});

const messagePayloadSchema = z.object({
  content: z.string().optional(),
  parentId: z.string().optional().nullable(),
  attachment: attachmentSchema.optional().nullable(),
  requestId: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasContent = Boolean(data.content?.trim());
  const hasAttachment = Boolean(data.attachment);

  if (!hasContent && !hasAttachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Message content or attachment is required",
      path: ["content"],
    });
  }
});

export const createChannelMessageSchema = messagePayloadSchema;
export const createDirectMessageSchema = messagePayloadSchema;

export const sendMessageSchema = messagePayloadSchema.extend({
  channelId: z.string(),
});

export const sendDirectMessageSchema = messagePayloadSchema.extend({
  conversationId: z.string(),
});

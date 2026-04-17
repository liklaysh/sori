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
  categoryId: z.string().uuid().optional().or(z.string().length(0)),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(32),
});

export const sendMessageSchema = z.object({
  channelId: z.string(),
  content: z.string().optional(),
  parentId: z.string().optional(),
  attachment: z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileSize: z.number().optional(),
    fileType: z.string().optional()
  }).optional(),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileSize: z.number().optional(),
    fileType: z.string().optional()
  })).optional()
});

export const sendDirectMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().optional(),
  attachment: z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileSize: z.number().optional(),
    fileType: z.string().optional()
  }).optional(),
  attachments: z.array(z.object({
    fileUrl: z.string(),
    fileName: z.string(),
    fileSize: z.number().optional(),
    fileType: z.string().optional()
  })).optional()
});

import { normalizeS3Url } from "./url.js";
import { sanitizeUser } from "./publicUser.js";

export interface MessageAttachment {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileType?: string | null;
}

type AuthorLike = {
  avatarUrl?: string | null;
  [key: string]: any;
};

type ReactionLike = {
  user?: AuthorLike | null;
  [key: string]: any;
};

type MessageLike = {
  attachments?: string | MessageAttachment[] | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  author?: AuthorLike | null;
  parent?: MessageLike | null;
  reactions?: ReactionLike[] | null;
  [key: string]: any;
};

export function extractAttachments(input: {
  attachment?: MessageAttachment | null;
  attachments?: MessageAttachment[] | null;
}) {
  if (Array.isArray(input.attachments) && input.attachments.length > 0) {
    return input.attachments.filter((attachment) => Boolean(attachment?.fileUrl && attachment?.fileName));
  }

  return input.attachment ? [input.attachment] : [];
}

export function buildAttachment(input: {
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
}) {
  if (!input.fileUrl || !input.fileName) {
    return null;
  }

  return {
    fileUrl: normalizeS3Url(input.fileUrl) || input.fileUrl,
    fileName: input.fileName,
    fileSize: input.fileSize ?? null,
    fileType: input.fileType ?? null,
  };
}

function parseAttachments(raw: string | MessageAttachment[] | null | undefined) {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map((attachment) => buildAttachment(attachment))
      .filter(Boolean) as MessageAttachment[];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((attachment) => buildAttachment(attachment))
      .filter(Boolean) as MessageAttachment[];
  } catch {
    return [];
  }
}

export function buildAttachments(input: {
  attachments?: string | MessageAttachment[] | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
}) {
  const parsedAttachments = parseAttachments(input.attachments);
  if (parsedAttachments.length > 0) {
    return parsedAttachments;
  }

  const legacyAttachment = buildAttachment(input);
  return legacyAttachment ? [legacyAttachment] : [];
}

function normalizeAuthor(author?: AuthorLike | null) {
  return sanitizeUser(author);
}

function normalizeReactions(reactions?: ReactionLike[] | null) {
  if (!reactions) {
    return reactions ?? [];
  }

  return reactions.map((reaction) => ({
    ...reaction,
    user: normalizeAuthor(reaction.user),
  }));
}

export function serializeMessage(message: MessageLike | null | undefined): any {
  if (!message) {
    return null;
  }

  const {
    attachments: _attachments,
    fileUrl: _fileUrl,
    fileName: _fileName,
    fileSize: _fileSize,
    fileType: _fileType,
    ...rest
  } = message;
  const attachments = buildAttachments(message);
  const attachment = attachments[0] || null;

  return {
    ...rest,
    author: normalizeAuthor(message.author),
    parent: message.parent ? serializeMessage(message.parent) : null,
    reactions: normalizeReactions(message.reactions),
    attachments,
    attachment,
  };
}

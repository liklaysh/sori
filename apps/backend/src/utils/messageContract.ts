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
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  author?: AuthorLike | null;
  parent?: MessageLike | null;
  reactions?: ReactionLike[] | null;
  [key: string]: any;
};

export function extractAttachment(input: {
  attachment?: MessageAttachment | null;
}) {
  return input.attachment || null;
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
    fileUrl: _fileUrl,
    fileName: _fileName,
    fileSize: _fileSize,
    fileType: _fileType,
    ...rest
  } = message;
  const attachment = buildAttachment(message);

  return {
    ...rest,
    author: normalizeAuthor(message.author),
    parent: message.parent ? serializeMessage(message.parent) : null,
    reactions: normalizeReactions(message.reactions),
    attachment,
  };
}

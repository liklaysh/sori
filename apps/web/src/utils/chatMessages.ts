import { Attachment, ChatItem, Message } from "../types/chat";

export const getChannelContextKey = (channelId: string) => `channel:${channelId}`;
export const getConversationContextKey = (conversationId: string) => `dm:${conversationId}`;

export function getMessageContextKey(message: Pick<Message, "channelId" | "conversationId">) {
  if (message.conversationId) {
    return getConversationContextKey(message.conversationId);
  }

  if (message.channelId) {
    return getChannelContextKey(message.channelId);
  }

  return null;
}

export function getMessageAttachments(message: Pick<Message, "attachments" | "attachment">) {
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }

  return message.attachment ? [message.attachment] : [];
}

export function getMessageAttachment(message: Pick<Message, "attachments" | "attachment">): Attachment | null {
  return getMessageAttachments(message)[0] || null;
}

export function normalizeMessage<T extends Message>(message: T): T {
  const attachments = getMessageAttachments(message);

  return {
    ...message,
    attachments,
    attachment: attachments[0] || null,
  };
}

export function normalizeChatItem<T extends ChatItem>(item: T): T {
  if (item.type === "system_call") {
    return item;
  }

  return normalizeMessage(item as Message) as T;
}

export function normalizeChatItems<T extends ChatItem>(items: T[]) {
  return items.map((item) => normalizeChatItem(item));
}

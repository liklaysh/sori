import { ChatItem, Message } from "../types/chat";

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

export function getMessageAttachment(message: Pick<Message, "attachment">) {
  return message.attachment || null;
}

export function normalizeMessage<T extends Message>(message: T): T {
  return {
    ...message,
    attachment: getMessageAttachment(message),
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

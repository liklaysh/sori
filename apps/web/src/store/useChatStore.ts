import { create } from "zustand";
import api from "../lib/api";
import { Channel, Community, Member, VoiceOccupant, DMConversation, ChatItem, Message } from "../types/chat";
import { useUserStore } from "./useUserStore";
import {
  getChannelContextKey,
  getConversationContextKey,
  getMessageContextKey,
  normalizeChatItems,
  normalizeMessage,
} from "../utils/chatMessages";

interface FetchMessagesOptions {
  search?: string;
  before?: string;
  append?: boolean;
}

interface ChatState {
  communities: Community[];
  channels: Channel[];
  messagesByContext: Record<string, ChatItem[]>;
  members: Member[];
  conversations: DMConversation[];
  voiceOccupants: Record<string, VoiceOccupant[]>;
  activeCommunityId: string | null;
  typingUsers: Record<string, string>;

  setCommunities: (cms: Community[]) => void;
  setChannels: (chs: Channel[]) => void;
  setContextMessages: (contextKey: string, msgs: ChatItem[] | ((prev: ChatItem[]) => ChatItem[])) => void;
  addMessage: (msg: ChatItem) => void;
  updateMessage: (messageId: string, data: Partial<Message>) => void;
  setMembers: (mbs: Member[]) => void;
  setConversations: (convs: DMConversation[]) => void;
  setVoiceOccupants: (occupants: Record<string, VoiceOccupant[]>) => void;
  updateVoiceOccupants: (channelId: string, occupants: VoiceOccupant[]) => void;
  updateOccupantStatus: (channelId: string, userId: string, data: Partial<VoiceOccupant>) => void;
  updateUserReferences: (user: { id: string; username?: string | null; avatarUrl?: string | null; status?: Member["status"] | null }) => void;
  setTyping: (channelId: string, username: string | null) => void;
  upsertConversation: (conv: DMConversation) => void;
  startDM: (targetUserId: string) => Promise<DMConversation | null>;
  fetchInitialData: (communityId: string) => Promise<void>;
  fetchConversations: () => Promise<void>;
  fetchMessages: (channelId: string, options?: FetchMessagesOptions) => Promise<ChatItem[]>;
  fetchDMMessages: (conversationId: string, options?: FetchMessagesOptions) => Promise<ChatItem[]>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
}

function normalizeConversation(conversation: DMConversation): DMConversation {
  const unreadCount = Number(conversation.unreadCount || 0);

  return {
    ...conversation,
    unreadCount: unreadCount > 0 ? unreadCount : 0,
  };
}

function sortVoiceOccupantsByJoinTime(occupants: VoiceOccupant[]) {
  return [...occupants].sort((a, b) => {
    const joinedAtA = Number(a.joinedAt || 0);
    const joinedAtB = Number(b.joinedAt || 0);
    return joinedAtA - joinedAtB;
  });
}

function dedupeMessages(messages: ChatItem[]) {
  const seen = new Set<string>();

  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }

    seen.add(message.id);
    return true;
  });
}

function mergeMessagePages(existing: ChatItem[], incoming: ChatItem[], append: boolean) {
  return dedupeMessages(append ? [...incoming, ...existing] : incoming);
}

export const useChatStore = create<ChatState>((set, get) => ({
  communities: [],
  channels: [],
  messagesByContext: {},
  members: [],
  conversations: [],
  voiceOccupants: {},
  activeCommunityId: null,
  typingUsers: {},

  setCommunities: (communities) => set({ communities }),
  setChannels: (channels) => set({ channels }),
  setContextMessages: (contextKey, messages) => set((state) => {
    const previous = state.messagesByContext[contextKey] || [];
    const nextMessages = typeof messages === "function" ? messages(previous) : messages;

    return {
      messagesByContext: {
        ...state.messagesByContext,
        [contextKey]: normalizeChatItems(nextMessages),
      },
    };
  }),
  addMessage: (message) => set((state) => {
    if (message.type === "system_call") {
      return state;
    }

    const normalizedMessage = normalizeMessage(message as Message);
    const contextKey = getMessageContextKey(normalizedMessage);

    if (!contextKey) {
      return state;
    }

    const existing = state.messagesByContext[contextKey] || [];
    if (existing.some((item) => item.id === normalizedMessage.id)) {
      return state;
    }

    return {
      messagesByContext: {
        ...state.messagesByContext,
        [contextKey]: [...existing, normalizedMessage],
      },
    };
  }),
  updateMessage: (messageId, data) => set((state) => {
    const nextBuckets = Object.fromEntries(
      Object.entries(state.messagesByContext).map(([contextKey, messages]) => [
        contextKey,
        messages.map((message) => {
          if (message.id !== messageId || message.type === "system_call") {
            return message;
          }

          return normalizeMessage({
            ...(message as Message),
            ...data,
          });
        }),
      ]),
    );

    return { messagesByContext: nextBuckets };
  }),
  setMembers: (members) => set({ members }),
  setConversations: (conversations) => set({
    conversations: conversations.map(normalizeConversation),
  }),
  setVoiceOccupants: (voiceOccupants) => set({
    voiceOccupants: Object.fromEntries(
      Object.entries(voiceOccupants).map(([channelId, occupants]) => [
        channelId,
        sortVoiceOccupantsByJoinTime(occupants),
      ]),
    ),
  }),
  updateVoiceOccupants: (channelId, occupants) => set((state) => ({
    voiceOccupants: { ...state.voiceOccupants, [channelId]: sortVoiceOccupantsByJoinTime(occupants) }
  })),
  updateOccupantStatus: (channelId, userId, data) => set((state) => {
    const occupants = state.voiceOccupants[channelId] || [];
    const updated = occupants.map(o => o.userId === userId ? { ...o, ...data } : o);
    return {
      voiceOccupants: { ...state.voiceOccupants, [channelId]: sortVoiceOccupantsByJoinTime(updated) }
    };
  }),
  updateUserReferences: (user) => set((state) => {
    const patchUser = <T extends { id?: string; username?: string; avatarUrl?: string | null; status?: string } | null | undefined>(candidate: T): T => {
      if (!candidate || candidate.id !== user.id) {
        return candidate;
      }

      return {
        ...candidate,
        ...(user.username !== undefined && user.username !== null ? { username: user.username } : {}),
        ...(user.avatarUrl !== undefined ? { avatarUrl: user.avatarUrl } : {}),
        ...(user.status !== undefined && user.status !== null ? { status: user.status } : {}),
      };
    };

    const patchMessage = (item: ChatItem): ChatItem => {
      if (item.type === "system_call") {
        return item;
      }

      const message = item as Message;
      return normalizeMessage({
        ...message,
        ...(message.authorId === user.id && user.username ? { username: user.username } : {}),
        author: patchUser(message.author),
      });
    };

    return {
      members: state.members.map((member) => member.id === user.id ? patchUser(member)! : member),
      conversations: state.conversations.map((conversation) => normalizeConversation({
        ...conversation,
        user1: patchUser(conversation.user1),
        user2: patchUser(conversation.user2),
      })),
      voiceOccupants: Object.fromEntries(
        Object.entries(state.voiceOccupants).map(([channelId, occupants]) => [
          channelId,
          sortVoiceOccupantsByJoinTime(occupants.map((occupant) => occupant.userId === user.id ? {
            ...occupant,
            ...(user.username !== undefined && user.username !== null ? { username: user.username } : {}),
            ...(user.avatarUrl !== undefined ? { avatarUrl: user.avatarUrl } : {}),
          } : occupant)),
        ]),
      ),
      messagesByContext: Object.fromEntries(
        Object.entries(state.messagesByContext).map(([contextKey, messages]) => [
          contextKey,
          messages.map(patchMessage),
        ]),
      ),
    };
  }),
  setTyping: (channelId, username) => set((state) => {
    const next = { ...state.typingUsers };
    if (username) next[channelId] = username;
    else delete next[channelId];
    return { typingUsers: next };
  }),
  upsertConversation: (conv) => set((state) => {
    const normalizedConversation = normalizeConversation(conv);
    const exists = state.conversations.some(c => c.id === conv.id);
    if (exists) {
      return {
        conversations: state.conversations.map(c => c.id === conv.id ? normalizeConversation({ ...c, ...normalizedConversation }) : c)
      };
    }
    return { conversations: [normalizedConversation, ...state.conversations] };
  }),
  startDM: async (targetUserId) => {
    try {
      const currentUserId = useUserStore.getState().user?.id;
      if (!targetUserId || targetUserId === currentUserId) {
        return null;
      }
      const res = await api.post("/dm/conversations", { targetUserId });
      const data = res.data as DMConversation;
      if (data && data.id) {
        get().upsertConversation(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error("[ChatStore] startDM failed:", err);
      return null;
    }
  },

  fetchInitialData: async (communityId) => {
    const [commsRes, channelsRes, membersRes] = await Promise.all([
      api.get("/communities"),
      api.get(`/communities/${communityId}/channels`),
      api.get(`/communities/${communityId}/members`)
    ]);
    set({
      communities: (commsRes.data as Community[]) || [],
      channels: (channelsRes.data as Channel[]) || [],
      members: (membersRes.data as Member[]) || [],
      activeCommunityId: communityId
    });
  },

  fetchConversations: async () => {
    const res = await api.get("/dm/conversations");
    set({ conversations: ((res.data as DMConversation[]) || []).map(normalizeConversation) });
  },

  fetchMessages: async (channelId, options = {}) => {
    const params = new URLSearchParams();
    if (options.search?.trim()) params.set("q", options.search.trim());
    if (options.before) params.set("before", options.before);

    const url = params.size > 0
      ? `/channels/${channelId}/messages?${params.toString()}`
      : `/channels/${channelId}/messages`;

    const res = await api.get(url);
    const contextKey = getChannelContextKey(channelId);
    const fetched = normalizeChatItems((res.data as ChatItem[]) || []);

    set((state) => ({
      messagesByContext: {
        ...state.messagesByContext,
        [contextKey]: mergeMessagePages(state.messagesByContext[contextKey] || [], fetched, Boolean(options.append)),
      },
    }));

    return fetched;
  },

  fetchDMMessages: async (conversationId, options = {}) => {
    const params = new URLSearchParams();
    if (options.search?.trim()) params.set("q", options.search.trim());
    if (options.before) params.set("before", options.before);

    const url = params.size > 0
      ? `/dm/conversations/${conversationId}/messages?${params.toString()}`
      : `/dm/conversations/${conversationId}/messages`;

    const res = await api.get(url);
    const contextKey = getConversationContextKey(conversationId);
    const fetched = normalizeChatItems((res.data as ChatItem[]) || []);

    set((state) => ({
      messagesByContext: {
        ...state.messagesByContext,
        [contextKey]: mergeMessagePages(state.messagesByContext[contextKey] || [], fetched, Boolean(options.append)),
      },
    }));

    return fetched;
  },

  markConversationAsRead: async (conversationId) => {
    const conv = get().conversations.find(c => c.id === conversationId);
    if (!conv || (conv.unreadCount || 0) <= 0) return;

    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    }));

    try {
      await api.post(`/dm/conversations/${conversationId}/read`);
    } catch (err) {
      console.error("[ChatStore] markAsRead failed:", err);
    }
  }
}));

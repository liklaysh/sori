import { create } from "zustand";
import api from "../lib/api";
import { Message, Channel, Community, Member, VoiceOccupant, DMConversation, ChatItem } from "../types/chat";
import { Socket } from "socket.io-client";

interface ChatState {
  communities: Community[];
  channels: Channel[];
  messages: ChatItem[];
  members: Member[];
  conversations: DMConversation[];
  voiceOccupants: Record<string, VoiceOccupant[]>;
  typingUsers: Record<string, string>;
  
  // Actions
  setCommunities: (cms: Community[]) => void;
  setChannels: (chs: Channel[]) => void;
  setMessages: (msgs: ChatItem[] | ((prev: ChatItem[]) => ChatItem[])) => void;
  addMessage: (msg: ChatItem) => void;
  setMembers: (mbs: Member[]) => void;
  setConversations: (convs: DMConversation[]) => void;
  setVoiceOccupants: (occupants: Record<string, VoiceOccupant[]>) => void;
  updateVoiceOccupants: (channelId: string, occupants: VoiceOccupant[]) => void;
  setTyping: (channelId: string, username: string | null) => void;
  upsertConversation: (conv: DMConversation) => void;
  
  // Async Fetches
  fetchInitialData: (communityId: string) => Promise<void>;
  fetchConversations: () => Promise<void>;
  fetchMessages: (channelId: string, search?: string) => Promise<void>;
  fetchDMMessages: (conversationId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  communities: [],
  channels: [],
  messages: [],
  members: [],
  conversations: [],
  voiceOccupants: {},
  typingUsers: {},

  setCommunities: (communities) => set({ communities }),
  setChannels: (channels) => set({ channels }),
  setMessages: (messages) => set((state) => ({ 
    messages: typeof messages === "function" ? messages(state.messages) : messages 
  })),
  addMessage: (msg) => set((state) => {
    if (state.messages.some(m => m.id === msg.id)) return state;
    return { messages: [...state.messages, msg] };
  }),
  setMembers: (members) => set({ members }),
  setConversations: (conversations) => set({ conversations }),
  setVoiceOccupants: (voiceOccupants) => set({ voiceOccupants }),
  updateVoiceOccupants: (channelId, occupants) => set((state) => ({
    voiceOccupants: { ...state.voiceOccupants, [channelId]: occupants }
  })),
  setTyping: (channelId, username) => set((state) => {
    const next = { ...state.typingUsers };
    if (username) next[channelId] = username;
    else delete next[channelId];
    return { typingUsers: next };
  }),
  upsertConversation: (conv) => set((state) => {
    const exists = state.conversations.some(c => c.id === conv.id);
    if (exists) {
      return {
        conversations: state.conversations.map(c => c.id === conv.id ? { ...c, ...conv } : c)
      };
    }
    return { conversations: [conv, ...state.conversations] };
  }),

  fetchInitialData: async (communityId) => {
    const [commsRes, channelsRes, membersRes] = await Promise.all([
      api.get("/communities"),
      api.get(`/communities/${communityId}/channels`),
      api.get(`/communities/${communityId}/members`)
    ]);
    set({ 
      communities: (commsRes.data as Community[]) || [], 
      channels: (channelsRes.data as Channel[]) || [], 
      members: (membersRes.data as Member[]) || [] 
    });
  },

  fetchConversations: async () => {
    const res = await api.get("/dm/conversations");
    set({ conversations: (res.data as DMConversation[]) || [] });
  },

  fetchMessages: async (channelId: string, search?: string) => {
    const url = search ? `/channels/${channelId}/messages?q=${search}` : `/channels/${channelId}/messages`;
    const res = await api.get(url);
    set({ messages: (res.data as ChatItem[]) || [] });
  },

  fetchDMMessages: async (conversationId) => {
    const res = await api.get(`/dm/conversations/${conversationId}/messages`);
    set({ messages: (res.data as ChatItem[]) || [] });
  }
}));

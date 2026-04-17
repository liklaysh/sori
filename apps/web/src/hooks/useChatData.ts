import { useState } from "react";
import api from "../lib/api";
import { Message, Channel, Community, Category, Member, VoiceOccupant, User, DMConversation, ChatItem } from "../types/chat";

export function useChatData(onlineUsersSetRef: React.MutableRefObject<Set<string>>) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [currentCommunity, setCurrentCommunity] = useState<Community | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const fetchCommunities = async () => {
    // Basic implementation for default community
    const dynamicName = "Sori Sanctuary";
    const defaultComm = { id: "default-community", name: dynamicName };
    setCommunities([defaultComm]);
    setCurrentCommunity(defaultComm);
  };

  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const res = await api.get("/dm/conversations");
      setConversations(res.data || []);
    } catch (err) { console.error("Conversations fetch failed", err); }
    finally { setIsLoadingConversations(false); }
  };

  const fetchDMMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await api.get(`/dm/conversations/${conversationId}/messages`);
      const mapped: ChatItem[] = res.data.map((m: any) => {
        if (m.type === "system_call") return m;
        return {
          id: m.id,
          content: m.content,
          authorId: m.authorId,
          author: m.author,
          channelId: "dm",
          createdAt: m.createdAt,
          type: m.type
        };
      });
      setMessages(mapped.reverse());
    } catch (err) { console.error("DM Messages fetch failed", err); }
    finally { setIsLoadingMessages(false); }
  };

  const fetchCategories = async (communityId: string, onFetched?: (cats: Category[]) => void) => {
    try {
      const res = await api.get(`/communities/${communityId}/categories`);
      setCategories(res.data || []);
      if (onFetched) onFetched(res.data || []);
    } catch (err) { console.error("Categories fetch failed", err); }
  };

  const fetchChannels = async (communityId: string) => {
    setIsLoadingChannels(true);
    try {
      const res = await api.get(`/communities/${communityId}/channels`);
      setChannels(res.data || []);
      return res.data || [];
    } catch (err) {
      console.error("Channels fetch failed", err);
      return [];
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const fetchMessages = async (channelId: string, query: string) => {
    setIsLoadingMessages(true);
    try {
      const url = query 
        ? `/channels/${channelId}/messages?q=${encodeURIComponent(query)}`
        : `/channels/${channelId}/messages`;
      const res = await api.get(url);
      setMessages(res.data || []);
    } catch (err) { console.error("Messages fetch failed", err); }
    finally { setIsLoadingMessages(false); }
  };

  const fetchMoreMessages = async (channelId: string, before: string) => {
    try {
      const res = await api.get(`/channels/${channelId}/messages?before=${before}`);
      const newMsgs = res.data || [];
      if (newMsgs.length > 0) {
        setMessages(prev => [...newMsgs, ...prev]);
      }
      return newMsgs.length;
    } catch (err) { 
      console.error("Fetch more messages failed", err); 
      return 0;
    }
  };

  const fetchMoreDMMessages = async (conversationId: string, before: string) => {
    try {
      const res = await api.get(`/dm/conversations/${conversationId}/messages?before=${before}`);
      const mapped: ChatItem[] = res.data.map((m: any) => {
        if (m.type === "system_call") return m;
        return {
          id: m.id, content: m.content, authorId: m.authorId, author: m.author, channelId: "dm", createdAt: m.createdAt, type: m.type
        };
      });
      if (mapped.length > 0) {
        setMessages(prev => [...mapped.reverse(), ...prev]);
      }
      return mapped.length;
    } catch (err) { 
      console.error("Fetch more DM messages failed", err); 
      return 0;
    }
  };

  const fetchMembers = async (communityId: string) => {
    setIsLoadingMembers(true);
    try {
      const res = await api.get(`/communities/${communityId}/members`);
      setMembers(res.data || []);
    } catch (err) { console.error("Members fetch failed", err); }
    finally { setIsLoadingMembers(false); }
  };

  return {
    states: {
      messages, communities, currentCommunity, categories, channels,
      currentChannel, conversations, activeConversationId, members,
      isLoadingMessages, isLoadingChannels, isLoadingMembers, isLoadingConversations
    },
    setters: {
      setMessages, setCommunities, setCurrentCommunity, setCategories, setChannels,
      setCurrentChannel, setConversations, setActiveConversationId, setMembers
    },
    api: {
      fetchCommunities, fetchConversations, fetchDMMessages, fetchCategories,
      fetchChannels, fetchMessages, fetchMoreMessages, fetchMoreDMMessages, fetchMembers
    }
  };
}

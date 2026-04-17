import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import api from "../lib/api";
import { API_URL } from "../config";
import { Message, VoiceOccupant, Member, DMConversation, Channel, User, ChatItem } from "../types/chat";
import { toast } from "sonner";
import { useChatStore } from "../store/useChatStore";
import { useUserStore } from "../store/useUserStore";
import { useUIStore } from "../store/useUIStore";

export function useChatSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsersSet, setOnlineUsersSet] = useState<Set<string>>(new Set());
  
  // Zustand States & Actions
  const user = useUserStore(s => s.user);
  const { addMessage, setMessages, setMembers, setConversations, updateVoiceOccupants, voiceOccupants, setVoiceOccupants } = useChatStore();
  const { activeModule, activeConversationId } = useUIStore();
  const channels = useChatStore(s => s.channels);

  // Refs for socket callbacks (to avoid stale closures)
  const userRef = useRef(user);
  const activeModuleRef = useRef(activeModule);
  const activeConversationIdRef = useRef(activeConversationId);
  const channelsRef = useRef(channels);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  useEffect(() => {
    // We use cookies for auth, so withCredentials: true is enough.
    const socketUrl = API_URL;
    const newSocket: Socket = io(socketUrl, { 
      withCredentials: true,
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const refreshConversations = async () => {
      try {
        const res = await api.get("/dm/conversations");
        setConversations(res.data);
      } catch (err) { console.error("Failed to update conversations:", err); }
    };

    newSocket.on("connect", () => {
      console.log("[Socket] Connected to backend");
      setSocket(newSocket);
      refreshConversations();
    });

    newSocket.on("new_message", (m: Message & { username?: string, fileUrl?: string, fileType?: string }) => {
      const isMe = m.authorId === userRef.current?.id;
      if (isMe) {
        addMessage(m);
        return;
      }

      const content = m.content || "";
      const isEveryone = content.includes("@everyone");
      const isMentioned = content.includes(`@${userRef.current?.username}`);
      const isCurrentContext = activeModuleRef.current === 'community';

      addMessage(m);

      if (isEveryone || isMentioned || !isCurrentContext) {
        const channelName = channelsRef.current.find(c => c.id === m.channelId)?.name || "channel";
        const authorName = m.author?.username || m.username || "User";
        let displayContent = content;
        if (m.fileUrl) {
          if (m.fileType?.startsWith('image/')) displayContent = "(Image) " + displayContent;
          else if (m.fileType?.startsWith('video/')) displayContent = "(Video) " + displayContent;
          else displayContent = "(Document) " + displayContent;
        }

        toast((isEveryone || isMentioned) ? "You're mentioned" : `${authorName} in #${channelName}`, {
          description: displayContent
        });
      }
    });

    newSocket.on("new_direct_message", (m: any) => {
      if (activeModuleRef.current === 'dm' && activeConversationIdRef.current === m.conversationId) {
        newSocket.emit("mark_read", m.conversationId);
        addMessage({
          id: m.id, content: m.content, authorId: m.authorId, author: m.author, channelId: "dm", createdAt: m.createdAt,
          fileUrl: m.fileUrl, fileType: m.fileType, type: "text"
        });
      } else {
        const authorName = m.author?.username || "User";
        toast(`Direct from ${authorName}`, { description: m.content });
      }
      refreshConversations();
    });

    newSocket.on("presence_update", (d: { userId: string, status: string }) => {
      setOnlineUsersSet(prev => {
        const next = new Set(prev);
        if (d.status === 'online') next.add(d.userId); else next.delete(d.userId);
        return next;
      });
      refreshConversations();
    });

    newSocket.on("initial_presence", (userIds: string[]) => {
      setOnlineUsersSet(new Set(userIds));
      refreshConversations();
    });

    newSocket.on("message_updated", (data: any) => {
      setMessages(prev => prev.map(m => m.id === data.id && 'content' in m ? { ...m, ...data } : m));
    });

    newSocket.on("voice_occupants_state", (state: Record<string, VoiceOccupant[]>) => setVoiceOccupants(state));
    newSocket.on("voice_occupants_update", (data: { channelId: string, occupants: VoiceOccupant[] }) => updateVoiceOccupants(data.channelId, data.occupants));

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []); 

  useEffect(() => {
    if (socket) socket.emit("get_voice_state");
  }, [socket]);

  return { socket, onlineUsersSet, voiceOccupants };
}

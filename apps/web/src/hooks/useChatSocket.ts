import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import api from "../lib/api";
import { API_URL } from "../config";
import { Message, VoiceOccupant, DMConversation, ChatItem, CallLog } from "../types/chat";
import { toast } from "sonner";
import { useChatStore } from "../store/useChatStore";
import { useUserStore } from "../store/useUserStore";
import { useUIStore } from "../store/useUIStore";
import { useVoiceStore } from "../store/useVoiceStore";
import { getConversationContextKey, getMessageAttachment, normalizeMessage } from "../utils/chatMessages";

export function useChatSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsersSet, setOnlineUsersSet] = useState<Set<string>>(new Set());
  
  // Zustand States & Actions
  const user = useUserStore(s => s.user);
  const { 
    addMessage, updateMessage, setConversations, setContextMessages,
    updateVoiceOccupants, voiceOccupants, setVoiceOccupants,
    updateOccupantStatus
  } = useChatStore();
  const { activeModule, activeChannelId, activeConversationId, isMuted, isDeafened } = useUIStore();
  const connectedChannelId = useVoiceStore((state) => state.connectedChannelId);
  const channels = useChatStore(s => s.channels);

  // Refs for socket callbacks (to avoid stale closures)
  const userRef = useRef(user);
  const activeModuleRef = useRef(activeModule);
  const activeChannelIdRef = useRef(activeChannelId);
  const activeConversationIdRef = useRef(activeConversationId);
  const channelsRef = useRef(channels);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);
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
        setConversations((res.data as DMConversation[]) || []);
      } catch (err) { console.error("Failed to update conversations:", err); }
    };

    newSocket.on("connect", () => {
      setSocket(newSocket);
      refreshConversations();
    });

    newSocket.on("new_message", (incoming: Message & { username?: string }) => {
      const m = normalizeMessage(incoming);
      const isMe = m.authorId === userRef.current?.id;
      const attachment = getMessageAttachment(m);
      if (isMe) {
        addMessage(m);
        return;
      }

      const content = m.content || "";
      const isEveryone = content.includes("@everyone");
      const isMentioned = content.includes(`@${userRef.current?.username}`);
      const isCurrentChannelOpen = activeModuleRef.current === "community"
        && activeChannelIdRef.current === m.channelId;

      addMessage(m);

      if (isEveryone || isMentioned || !isCurrentChannelOpen) {
        const channelName = channelsRef.current.find(c => c.id === m.channelId)?.name || "channel";
        const authorName = m.author?.username || m.username || "User";
        let displayContent = content;
        if (attachment) {
          if (attachment.fileType?.startsWith('image/')) displayContent = "(Image) " + displayContent;
          else if (attachment.fileType?.startsWith('video/')) displayContent = "(Video) " + displayContent;
          else displayContent = "(Document) " + displayContent;
        }

        toast((isEveryone || isMentioned) ? "You're mentioned" : `${authorName} in #${channelName}`, {
          description: displayContent
        });
      }
    });

    newSocket.on("new_direct_message", (incoming: Message) => {
      const m = normalizeMessage(incoming);

      addMessage(m);

      if (activeModuleRef.current === 'dm' && activeConversationIdRef.current === m.conversationId) {
        api.post(`/dm/conversations/${m.conversationId}/read`).catch((err) => {
          console.error("Failed to mark DM as read:", err);
        });
      } else {
        const authorName = m.author?.username || "User";
        toast(`Direct from ${authorName}`, { description: m.content });
      }
      refreshConversations();
    });

    newSocket.on("new_call_log", (log: CallLog) => {
      const conversationId = log.conversationId;
      if (!conversationId) {
        return;
      }

      setContextMessages(getConversationContextKey(conversationId), (prev) => {
        if (prev.some((item) => item.id === log.id)) {
          return prev;
        }

        return [...prev, log];
      });

      refreshConversations();
    });

    newSocket.on("presence_update", (d: { userId: string, status: string }) => {
      setOnlineUsersSet(prev => {
        const next = new Set(prev);
        if (d.status === 'online') next.add(d.userId); else next.delete(d.userId);
        return next;
      });
    });

    newSocket.on("initial_presence", (userIds: string[]) => {
      setOnlineUsersSet(new Set(userIds));
    });

    newSocket.on("message_updated", (data: any) => {
      updateMessage(data.id, data);
    });

    newSocket.on("message_read", () => {
      refreshConversations();
    });

    newSocket.on("voice_occupants_state", (state: Record<string, VoiceOccupant[]>) => setVoiceOccupants(state));
    newSocket.on("voice_occupants_update", (data: { channelId: string, occupants: VoiceOccupant[] }) => updateVoiceOccupants(data.channelId, data.occupants));
    newSocket.on("user_speaking_status", (data: { channelId: string, userId: string, isSpeaking: boolean }) => {
      updateOccupantStatus(data.channelId, data.userId, { isSpeaking: data.isSpeaking });
    });
    newSocket.on("user_audio_status", (data: { channelId: string, userId: string, isMuted: boolean, isDeafened: boolean }) => {
      updateOccupantStatus(data.channelId, data.userId, {
        isMuted: data.isMuted,
        isDeafened: data.isDeafened,
      });
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []); 

  useEffect(() => {
    if (socket) socket.emit("get_voice_state");
  }, [socket]);

  useEffect(() => {
    if (!socket || !connectedChannelId || !user?.id) {
      return;
    }

    updateOccupantStatus(connectedChannelId, user.id, { isMuted, isDeafened });
    socket.emit("user_audio_status_update", { channelId: connectedChannelId, isMuted, isDeafened });
  }, [socket, connectedChannelId, user?.id, isMuted, isDeafened, updateOccupantStatus]);

  return { socket, onlineUsersSet, voiceOccupants };
}

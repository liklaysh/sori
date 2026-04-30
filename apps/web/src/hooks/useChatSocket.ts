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
import { getConversationContextKey, getMessageAttachments, normalizeMessage } from "../utils/chatMessages";
import { playNotificationSound } from "../utils/notificationSounds";
import i18n from "../i18n";

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
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());

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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const refreshConversations = async () => {
      try {
        const res = await api.get("/dm/conversations");
        setConversations((res.data as DMConversation[]) || []);
      } catch (err) { console.error("Failed to update conversations:", err); }
    };

    const shouldNotifyMessage = (messageId: string) => {
      const seen = notifiedMessageIdsRef.current;
      if (seen.has(messageId)) {
        return false;
      }

      if (seen.size > 500) {
        seen.clear();
      }

      seen.add(messageId);
      return true;
    };

    newSocket.on("connect", () => {
      setSocket(newSocket);
      const activeVoiceChannelId = useVoiceStore.getState().connectedChannelId;
      if (activeVoiceChannelId) {
        newSocket.emit("join_voice_channel", activeVoiceChannelId);
        const { isMuted: muted, isDeafened: deafened } = useUIStore.getState();
        newSocket.emit("user_audio_status_update", {
          channelId: activeVoiceChannelId,
          isMuted: muted,
          isDeafened: deafened,
        });
      }
      refreshConversations();
    });

    newSocket.on("new_message", (incoming: Message & { username?: string }) => {
      const m = normalizeMessage(incoming);
      const isMe = m.authorId === userRef.current?.id;
      const attachments = getMessageAttachments(m);
      const attachment = attachments[0] || null;
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
      if (shouldNotifyMessage(m.id)) {
        playNotificationSound("newMessage");
      }

      if (
        useUIStore.getState().notificationSettings.channelMessagePopups
        && (isEveryone || isMentioned || !isCurrentChannelOpen)
      ) {
        const channelName = channelsRef.current.find(c => c.id === m.channelId)?.name || "channel";
        const authorName = m.author?.username || m.username || "User";
        let displayContent = content;
        if (attachment) {
          if (attachments.length > 1) displayContent = `(Files: ${attachments.length}) ` + displayContent;
          else if (attachment.fileType?.startsWith('image/')) displayContent = "(Image) " + displayContent;
          else if (attachment.fileType?.startsWith('video/')) displayContent = "(Video) " + displayContent;
          else displayContent = "(Document) " + displayContent;
        }

        toast((isEveryone || isMentioned)
          ? i18n.t("notifications:mentions.youWereMentioned")
          : i18n.t("notifications:mentions.inChannel", { authorName, channelName }), {
          description: displayContent
        });
      }
    });

    newSocket.on("new_direct_message", (incoming: Message) => {
      const m = normalizeMessage(incoming);
      const isMe = m.authorId === userRef.current?.id;

      addMessage(m);

      if (isMe) {
        refreshConversations();
        return;
      }

      if (shouldNotifyMessage(m.id)) {
        playNotificationSound("newMessage");
      }

      if (activeModuleRef.current === 'dm' && activeConversationIdRef.current === m.conversationId) {
        api.post(`/dm/conversations/${m.conversationId}/read`).catch((err) => {
          console.error("Failed to mark DM as read:", err);
        });
      } else if (useUIStore.getState().notificationSettings.directMessagePopups) {
        const authorName = m.author?.username || "User";
        toast(i18n.t("notifications:mentions.directFrom", { authorName }), { description: m.content });
      }
      refreshConversations();
    });

    newSocket.on("new_call_log", (log: CallLog | null) => {
      if (!log) {
        return;
      }

      const normalizedLog: CallLog = {
        ...log,
        type: "system_call",
      };
      const conversationId = normalizedLog.conversationId;
      if (!conversationId) {
        return;
      }

      setContextMessages(getConversationContextKey(conversationId), (prev) => {
        if (prev.some((item) => item.id === normalizedLog.id)) {
          return prev;
        }

        return [...prev, normalizedLog];
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

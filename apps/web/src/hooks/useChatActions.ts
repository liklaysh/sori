import { useCallback } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Message, Channel, User, Attachment, DMConversation } from "../types/chat";
import { Socket } from "socket.io-client";
import { useUserStore } from "../store/useUserStore";

interface UseChatActionsProps {
  socket: Socket | null;
  states: any;
  setters: any;
  api: any; // Context api from useChatData
  uiSetters: any;
  navigate: (path: string) => void;
  callApi: any;
}

export const useChatActions = ({
  socket, states, setters, api: chatApi, uiSetters, navigate, callApi
}: UseChatActionsProps) => {
  const { logout } = useUserStore();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleCreateChannel = async (name: string, type: "text" | "voice", categoryId: string) => {
    if (!name.trim() || !states.currentCommunity) return;
    try {
      const res = await api.post(`/communities/${states.currentCommunity.id}/channels`, 
        { name, type, categoryId: categoryId || states.categories[0]?.id }
      );
      await chatApi.fetchChannels(states.currentCommunity.id);
      setters.setCurrentChannel(res.data);
      uiSetters.setIsModalOpen(false);
      toast.success("Channel created!");
    } catch (err) { toast.error("Failed to create channel."); }
  };

  const handleRenameChannel = async (channelId: string, newName: string) => {
    try {
      await api.patch(`/channels/${channelId}`, { name: newName });
      chatApi.fetchChannels("default-community");
      uiSetters.setIsRenameModalOpen(false);
      uiSetters.setChannelContextMenu((prev: any) => ({ ...prev, visible: false }));
      toast.success("Channel renamed!");
    } catch (err) { toast.error("Rename failed"); }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await api.delete(`/channels/${channelId}`);
      if (states.currentChannel?.id === channelId) setters.setCurrentChannel(null);
      chatApi.fetchChannels("default-community");
      uiSetters.setIsDeleteModalOpen(false);
      uiSetters.setChannelContextMenu((prev: any) => ({ ...prev, visible: false }));
      toast.success("Channel deleted");
    } catch (err) { toast.error("Delete failed"); }
  };

  const handleCreateCategory = async (name: string) => {
    if (!name.trim() || !states.currentCommunity) return;
    try {
      await api.post(`/communities/${states.currentCommunity.id}/categories`, { name });
      chatApi.fetchCategories(states.currentCommunity.id);
      uiSetters.setIsCategoryModalOpen(false);
      toast.success("Category created!");
    } catch (err) { toast.error("Failed to create category."); }
  };

  const handleStartDM = async (targetUserId: string) => {
    try {
      const res = await api.post("/dm/conversations", { targetUserId });
      setters.setConversations((prev: DMConversation[]) => {
        if (prev.some((c: DMConversation) => c.id === res.data.id)) return prev;
        return [res.data, ...prev];
      });
      uiSetters.setActiveModule('dm');
      setters.setActiveConversationId(res.data.id);
      uiSetters.setMemberContextMenu((prev: any) => ({ ...prev, visible: false }));
      uiSetters.setIsFindFriendOpen(false);
    } catch (err) { console.error("Failed to start DM", err); }
  };

  const handleSendMessage = useCallback((content: string, attachments?: Attachment[], activeModule?: string, replyTo?: Message | null, editingMessage?: Message | null) => {
    const hasAttachments = attachments && attachments.length > 0;
    if (!content.trim() && !hasAttachments) return;
    if (!socket) return;
    
    if (activeModule === 'dm' && states.activeConversationId) {
      socket.emit("send_direct_message", { 
        conversationId: states.activeConversationId, 
        content,
        attachments: attachments || []
      });
    } else if (states.currentChannel) {
      if (editingMessage) {
        socket.emit("edit_message", { messageId: editingMessage.id, content });
      } else {
        socket.emit("send_message", { 
          channelId: states.currentChannel.id, 
          content, 
          parentId: replyTo?.id,
          attachments: attachments || []
        });
      }
    }
  }, [socket, states.activeConversationId, states.currentChannel]);

  const handleExecuteForward = (targetId: string, isChannel: boolean, forwardData: any) => {
    if (!forwardData || !socket) return;

    const payload = {
      content: forwardData.content,
      attachments: forwardData.fileUrl ? [{
        fileUrl: forwardData.fileUrl,
        fileName: forwardData.fileName,
        fileSize: forwardData.fileSize,
        fileType: forwardData.fileType
      }] : []
    };

    if (isChannel) {
      socket.emit("send_message", { channelId: targetId, ...payload });
      toast.success("Forwarded to channel");
    } else {
      socket.emit("send_direct_message", { conversationId: targetId, ...payload });
      toast.success("Forwarded to conversation");
    }

    uiSetters.setIsForwardModalOpen(false);
    uiSetters.setForwardData(null);
  };

  // Message Actions
  const handleEditMessage = (message: Message, setInputValue: (v: string) => void, setEditingMessage: (m: Message | null) => void) => {
    setEditingMessage(message);
    setInputValue(message.content);
    uiSetters.setMessageContextMenu((prev: any) => ({ ...prev, visible: false }));
  };

  const handleDeleteMessage = (messageId: string) => {
    socket?.emit("delete_message", messageId);
    uiSetters.setMessageContextMenu((prev: any) => ({ ...prev, visible: false }));
  };

  const handleReplyMessage = (message: Message, setReplyTo: (m: Message | null) => void) => {
     setReplyTo(message);
     uiSetters.setMessageContextMenu((prev: any) => ({ ...prev, visible: false }));
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    socket?.emit("add_reaction", { messageId, emoji });
    uiSetters.setMessageContextMenu((prev: any) => ({ ...prev, visible: false }));
  };

  return {
    handleLogout,
    handleCreateChannel,
    handleRenameChannel,
    handleDeleteChannel,
    handleCreateCategory,
    handleStartDM,
    handleSendMessage,
    handleExecuteForward,
    handleEditMessage,
    handleDeleteMessage,
    handleReplyMessage,
    handleAddReaction
  };
};
